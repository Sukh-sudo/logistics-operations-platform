import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  HandheldAction,
  HandheldResultStatus,
  HandheldSessionEventType,
  HandheldSessionState,
  HandheldTaskType,
  PackageEventType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { TransactionHook } from '../../../common/domain/transaction-hook';
import { ContainerService } from '../../containers/services/container.service';
import { PackageService } from '../../packages/services/package.service';
import { TrailerService } from '../../trailers/services/trailer.service';
import { CreateWorkSessionDto } from '../dto/create-work-session.dto';
import { HandheldScanDto } from '../dto/handheld-scan.dto';
import { HandheldSyncDto } from '../dto/sync.dto';

@Injectable()
export class HandheldService implements OnModuleInit, OnModuleDestroy {
  private readonly inactivityMs =
    Number(process.env.HANDHELD_INACTIVITY_MINUTES ?? 15) * 60_000;
  private readonly lowAccuracyMetres =
    Number(process.env.HANDHELD_GPS_ACCURACY_METRES ?? 50);
  private inactivityTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly packages: PackageService,
    private readonly containers: ContainerService,
    private readonly trailers: TrailerService,
  ) {}

  onModuleInit() {
    const sweepMs = Number(
      process.env.HANDHELD_INACTIVITY_SWEEP_MS ?? 60_000,
    );
    this.inactivityTimer = setInterval(() => {
      // The database query is idempotent; an overlapping sweep simply finds no
      // ACTIVE candidate after the first transaction commits.
      void this.markInactiveSessions().catch(() => undefined);
    }, sweepMs);
    this.inactivityTimer.unref();
  }

  onModuleDestroy() {
    if (this.inactivityTimer) clearInterval(this.inactivityTimer);
  }

  async bootstrap(employeeId: string) {
    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId },
      include: { snapshot: true, primaryTerminal: true },
    });
    if (!employee?.snapshot || !employee.primaryTerminal) {
      throw new BadRequestException('Employee requires a permanent terminal');
    }
    const activeSessions = await this.prisma.handheldTaskSession.findMany({
      where: {
        employeeId,
        snapshot: { currentState: { not: HandheldSessionState.COMPLETED } },
      },
      include: { snapshot: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        roles: employee.snapshot.roleNames,
      },
      terminal: employee.primaryTerminal,
      authorizedTasks: this.authorizedTasks(employee.snapshot.roleNames),
      activeSessions,
      serverTime: new Date(),
      configuration: {
        inactivityMinutes: this.inactivityMs / 60_000,
        gpsLowAccuracyThresholdMetres: this.lowAccuracyMetres,
        localHistoryRetentionHours: 8,
      },
      apiVersion: 'mobile-v1',
    };
  }

  async startSession(
    employeeId: string,
    dto: CreateWorkSessionDto,
    correlationId: string = randomUUID(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.user.findUnique({
        where: { id: employeeId },
        include: { snapshot: true },
      });
      if (!employee?.snapshot || employee.primaryTerminalId === null) {
        throw new BadRequestException('Employee requires a permanent terminal');
      }
      const session = await tx.handheldTaskSession.create({
        data: {
          employeeId,
          terminalId: employee.primaryTerminalId,
          deviceId: dto.deviceId,
          taskType: dto.taskType,
        },
      });
      const event = await tx.handheldTaskSessionEvent.create({
        data: {
          taskSessionId: session.id,
          eventType: HandheldSessionEventType.SESSION_STARTED,
          correlationId,
          payload: { taskType: dto.taskType, deviceId: dto.deviceId },
        },
      });
      const snapshot = await tx.handheldTaskSessionSnapshot.create({
        data: {
          id: session.id,
          currentState: HandheldSessionState.ACTIVE,
          networkState: dto.networkState,
          lastAcceptedActivityAt: event.createdAt,
        },
      });
      await tx.handheldTaskInterval.create({
        data: { taskSessionId: session.id, startedAt: event.createdAt },
      });
      return { session, snapshot, event };
    });
  }

  pauseSession(id: string, employeeId: string, correlationId?: string) {
    return this.transitionSession(
      id,
      employeeId,
      HandheldSessionState.PAUSED,
      HandheldSessionEventType.SESSION_PAUSED,
      correlationId,
    );
  }

  resumeSession(id: string, employeeId: string, correlationId?: string) {
    return this.transitionSession(
      id,
      employeeId,
      HandheldSessionState.ACTIVE,
      HandheldSessionEventType.SESSION_RESUMED,
      correlationId,
    );
  }

  completeSession(id: string, employeeId: string, correlationId?: string) {
    return this.transitionSession(
      id,
      employeeId,
      HandheldSessionState.COMPLETED,
      HandheldSessionEventType.SESSION_COMPLETED,
      correlationId,
    );
  }

  getActiveSessions(employeeId: string) {
    return this.prisma.handheldTaskSession.findMany({
      where: {
        employeeId,
        snapshot: { currentState: { not: HandheldSessionState.COMPLETED } },
      },
      include: { snapshot: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processScan(
    taskSessionId: string,
    employeeId: string,
    dto: HandheldScanDto,
  ) {
    const duplicate = await this.prisma.handheldCommandReceipt.findUnique({
      where: { clientEventId: dto.clientEventId },
    });
    if (duplicate) {
      return this.recordDuplicate(duplicate.id);
    }

    const session = await this.requireActiveSession(
      taskSessionId,
      employeeId,
      dto.deviceId,
    );
    this.validateActionForTask(session.taskType, dto.action);
    const correlationId = dto.clientEventId;
    try {
      const accepted = await this.dispatchDomainCommand(
        dto,
        correlationId,
        session.terminalId,
        async (tx, domainPackageEventId) =>
          this.recordAcceptedScan(
            tx,
            session.id,
            employeeId,
            dto,
            domainPackageEventId,
          ),
      );
      return this.presentReceipt(accepted);
    } catch (error) {
      // A parsed batch remains HTTP-successful; permanent business failures
      // become durable per-item results for operator correction.
      const outcome = this.errorOutcome(error);
      try {
        const rejected = await this.prisma.handheldCommandReceipt.create({
          data: this.receiptData(
            taskSessionId,
            employeeId,
            dto,
            HandheldResultStatus.REJECTED,
            outcome.code,
            outcome.message,
            this.deliveryExceptionFlags(dto),
          ),
        });
        return this.presentReceipt(rejected);
      } catch (persistError) {
        if (this.isUniqueViolation(persistError)) {
          const existing =
            await this.prisma.handheldCommandReceipt.findUniqueOrThrow({
              where: { clientEventId: dto.clientEventId },
            });
          return this.recordDuplicate(existing.id);
        }
        throw persistError;
      }
    }
  }

  async synchronize(
    taskSessionId: string,
    employeeId: string,
    dto: HandheldSyncDto,
  ) {
    // Preserve capture order for commands from the same task session.
    const events = [...dto.events].sort(
      (a, b) =>
        new Date(a.deviceTimestamp).getTime() -
        new Date(b.deviceTimestamp).getTime(),
    );
    const results: Awaited<ReturnType<HandheldService['processScan']>>[] = [];
    for (const event of events) {
      results.push(await this.processScan(taskSessionId, employeeId, event));
    }
    return { batchId: dto.batchId, results };
  }

  getSyncStatus(taskSessionId: string, employeeId: string) {
    return this.prisma.handheldCommandReceipt.groupBy({
      by: ['resultStatus'],
      where: { taskSessionId, employeeId },
      _count: { _all: true },
    });
  }

  async reverse(
    originalReceiptId: string,
    taskSessionId: string,
    employeeId: string,
    dto: HandheldScanDto,
  ) {
    const original = await this.prisma.handheldCommandReceipt.findUnique({
      where: { id: originalReceiptId },
    });
    if (
      !original ||
      original.employeeId !== employeeId ||
      original.resultStatus !== HandheldResultStatus.ACCEPTED ||
      original.reversedAt
    ) {
      throw new ConflictException('ORIGINAL_EVENT_NOT_REVERSIBLE');
    }
    const inverse = this.inverseAction(original.action);
    const reversed = await this.processScan(taskSessionId, employeeId, {
      ...dto,
      action: inverse,
      trackingNumber: original.trackingNumber ?? undefined,
      containerBarcode: original.containerBarcode ?? undefined,
      trailerBarcode: original.trailerBarcode ?? undefined,
      routeCode: original.routeCode ?? undefined,
      truckUnitNumber: original.truckUnitNumber ?? undefined,
    });
    if (reversed.resultStatus !== HandheldResultStatus.ACCEPTED) {
      return reversed;
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.handheldCommandReceipt.update({
        where: { id: original.id },
        data: { reversedAt: new Date() },
      });
      const receipt = await tx.handheldCommandReceipt.update({
        where: { id: reversed.id },
        data: {
          action: HandheldAction.REVERSE_EVENT,
          resultStatus: HandheldResultStatus.REVERSED,
          code: 'EVENT_REVERSED',
          originalReceiptId: original.id,
        },
      });
      return this.presentReceipt(receipt);
    });
  }

  async markInactiveSessions(now = new Date()) {
    const cutoff = new Date(now.getTime() - this.inactivityMs);
    const candidates = await this.prisma.handheldTaskSessionSnapshot.findMany({
      where: {
        currentState: HandheldSessionState.ACTIVE,
        lastAcceptedActivityAt: { lt: cutoff },
      },
    });
    for (const candidate of candidates) {
      await this.prisma.$transaction(async (tx) => {
        const event = await tx.handheldTaskSessionEvent.create({
          data: {
            taskSessionId: candidate.id,
            eventType: HandheldSessionEventType.SESSION_MARKED_INACTIVE,
            correlationId: randomUUID(),
            payload: { inactivityCutoff: cutoff.toISOString() },
          },
        });
        await tx.handheldTaskSessionSnapshot.update({
          where: { id: candidate.id },
          data: { currentState: HandheldSessionState.INACTIVE_OFFLINE },
        });
        await tx.handheldTaskInterval.updateMany({
          where: { taskSessionId: candidate.id, endedAt: null },
          data: {
            endedAt: candidate.lastAcceptedActivityAt
              ? new Date(
                  candidate.lastAcceptedActivityAt.getTime() +
                    this.inactivityMs,
                )
              : event.createdAt,
          },
        });
      });
    }
    return { markedInactive: candidates.length };
  }

  private async transitionSession(
    id: string,
    employeeId: string,
    state: HandheldSessionState,
    eventType: HandheldSessionEventType,
    correlationId: string = randomUUID(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.handheldTaskSession.findUnique({
        where: { id },
        include: { snapshot: true },
      });
      if (!session || session.employeeId !== employeeId) {
        throw new NotFoundException('Task session not found');
      }
      if (session.snapshot?.currentState === HandheldSessionState.COMPLETED) {
        throw new ConflictException('Completed task sessions cannot change');
      }
      const currentState = session.snapshot?.currentState;
      if (
        eventType === HandheldSessionEventType.SESSION_PAUSED &&
        currentState !== HandheldSessionState.ACTIVE &&
        currentState !== HandheldSessionState.INACTIVE_OFFLINE
      ) {
        throw new ConflictException('Only active task sessions can be paused');
      }
      if (
        eventType === HandheldSessionEventType.SESSION_RESUMED &&
        currentState !== HandheldSessionState.PAUSED &&
        currentState !== HandheldSessionState.INACTIVE_OFFLINE
      ) {
        throw new ConflictException('Only paused or inactive sessions can resume');
      }
      const event = await tx.handheldTaskSessionEvent.create({
        data: { taskSessionId: id, eventType, correlationId },
      });
      if (state === HandheldSessionState.ACTIVE) {
        await tx.handheldTaskInterval.create({
          data: { taskSessionId: id, startedAt: event.createdAt },
        });
      } else {
        await tx.handheldTaskInterval.updateMany({
          where: { taskSessionId: id, endedAt: null },
          data: { endedAt: event.createdAt },
        });
      }
      const snapshot = await tx.handheldTaskSessionSnapshot.update({
        where: { id },
        data: {
          currentState: state,
          ...(state === HandheldSessionState.ACTIVE
            ? { lastAcceptedActivityAt: event.createdAt }
            : {}),
        },
      });
      return { snapshot, event };
    });
  }

  private async requireActiveSession(
    id: string,
    employeeId: string,
    deviceId: string,
  ) {
    const session = await this.prisma.handheldTaskSession.findUnique({
      where: { id },
      include: { snapshot: true },
    });
    if (!session || session.employeeId !== employeeId) {
      throw new NotFoundException('Task session not found');
    }
    if (session.deviceId !== deviceId) {
      throw new ConflictException('DEVICE_SESSION_MISMATCH');
    }
    if (
      !session.snapshot ||
      !(<HandheldSessionState[]>[
        HandheldSessionState.ACTIVE,
        HandheldSessionState.INACTIVE_OFFLINE,
      ]).includes(session.snapshot.currentState)
    ) {
      throw new ConflictException('TASK_SESSION_INACTIVE');
    }
    return session;
  }

  private async dispatchDomainCommand<T>(
    dto: HandheldScanDto,
    correlationId: string,
    terminalId: number,
    transactionHook: TransactionHook<T>,
  ): Promise<T> {
    switch (dto.action) {
      case HandheldAction.LOAD_PACKAGE_TO_TRAILER: {
        const trackingNumber = this.required(
          dto.trackingNumber,
          'trackingNumber',
        );
        const trailer = await this.trailers.getTrailer(
          this.required(dto.trailerBarcode, 'trailerBarcode'),
        );
        const result = await this.trailers.loadPackage(
          trailer.id,
          { trackingNumber },
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.UNLOAD_PACKAGE_FROM_TRAILER: {
        const trackingNumber = this.required(
          dto.trackingNumber,
          'trackingNumber',
        );
        const trailer = await this.trailers.getTrailer(
          this.required(dto.trailerBarcode, 'trailerBarcode'),
        );
        const result = await this.trailers.unloadPackage(
          trailer.id,
          { trackingNumber },
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.LOAD_PACKAGE_TO_CONTAINER: {
        const trackingNumber = this.required(
          dto.trackingNumber,
          'trackingNumber',
        );
        const container = await this.containers.getContainer(
          this.required(dto.containerBarcode, 'containerBarcode'),
        );
        const result = await this.containers.loadPackage(
          container.id,
          { trackingNumber },
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.UNLOAD_PACKAGE_FROM_CONTAINER: {
        const trackingNumber = this.required(
          dto.trackingNumber,
          'trackingNumber',
        );
        const container = await this.containers.getContainer(
          this.required(dto.containerBarcode, 'containerBarcode'),
        );
        const result = await this.containers.unloadPackage(
          container.id,
          { trackingNumber },
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.LOAD_CONTAINER_TO_TRAILER:
      case HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER: {
        const trailer = await this.trailers.getTrailer(
          this.required(dto.trailerBarcode, 'trailerBarcode'),
        );
        const command = {
          containerBarcode: this.required(
            dto.containerBarcode,
            'containerBarcode',
          ),
        };
        if (dto.action === HandheldAction.LOAD_CONTAINER_TO_TRAILER) {
          const container = await this.containers.getContainer(
            command.containerBarcode,
          );
          if (container.currentStatus !== 'CLOSED') {
            throw new BadRequestException('CONTAINER_NOT_CLOSED');
          }
          const result = await this.trailers.loadContainer(
            trailer.id,
            command,
            correlationId,
            transactionHook,
          );
          return result.hookResult!;
        } else {
          const result = await this.trailers.unloadContainer(
            trailer.id,
            command,
            correlationId,
            transactionHook,
          );
          return result.hookResult!;
        }
      }
      case HandheldAction.CLOSE_CONTAINER: {
        const container = await this.containers.getContainer(
          this.required(dto.containerBarcode, 'containerBarcode'),
        );
        const result = await this.containers.closeContainer(
          container.id,
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.CLOSE_TRAILER: {
        const trailer = await this.trailers.getTrailer(
          this.required(dto.trailerBarcode, 'trailerBarcode'),
        );
        const result = await this.trailers.closeTrailer(
          trailer.id,
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.LOAD_PACKAGE_TO_ROUTE:
      case HandheldAction.REMOVE_PACKAGE_FROM_ROUTE: {
        const result = await this.packages.changeLastMileAssignment(
          this.required(dto.trackingNumber, 'trackingNumber'),
          this.required(dto.routeCode, 'routeCode'),
          this.required(dto.truckUnitNumber, 'truckUnitNumber'),
          dto.action === HandheldAction.REMOVE_PACKAGE_FROM_ROUTE,
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      case HandheldAction.PACKAGE_OUT_FOR_DELIVERY:
      case HandheldAction.PACKAGE_DELIVERED:
      case HandheldAction.PACKAGE_ATTEMPTED_DELIVERY:
      case HandheldAction.PACKAGE_DAMAGED:
      case HandheldAction.PACKAGE_MISROUTED:
      case HandheldAction.PACKAGE_RETURNED_TO_TERMINAL: {
        const trackingNumber = this.required(
          dto.trackingNumber,
          'trackingNumber',
        );
        const eventTypes: Partial<Record<HandheldAction, PackageEventType>> = {
          PACKAGE_OUT_FOR_DELIVERY:
            PackageEventType.PACKAGE_OUT_FOR_DELIVERY,
          PACKAGE_DELIVERED: PackageEventType.PACKAGE_DELIVERED,
          PACKAGE_ATTEMPTED_DELIVERY:
            PackageEventType.PACKAGE_ATTEMPTED_DELIVERY,
          PACKAGE_DAMAGED: PackageEventType.PACKAGE_DAMAGED,
          PACKAGE_MISROUTED: PackageEventType.PACKAGE_MISROUTED,
          PACKAGE_RETURNED_TO_TERMINAL:
            PackageEventType.PACKAGE_RETURNED_TO_TERMINAL,
        };
        const eventType = eventTypes[dto.action]!;
        const result = await this.packages.createPackageEvent(
          {
            trackingNumber,
            eventType,
            ...(dto.action === HandheldAction.PACKAGE_RETURNED_TO_TERMINAL
              ? { terminalId }
              : {}),
          },
          correlationId,
          transactionHook,
        );
        return result.hookResult!;
      }
      default:
        throw new BadRequestException('UNSUPPORTED_HANDHELD_ACTION');
    }
  }

  private async recordAcceptedScan(
    tx: Prisma.TransactionClient,
    taskSessionId: string,
    employeeId: string,
    dto: HandheldScanDto,
    domainPackageEventId?: string,
  ) {
    const current = await tx.handheldTaskSessionSnapshot.findUnique({
      where: { id: taskSessionId },
    });
    if (
      !current ||
      !(<HandheldSessionState[]>[
        HandheldSessionState.ACTIVE,
        HandheldSessionState.INACTIVE_OFFLINE,
      ]).includes(current.currentState)
    ) {
      throw new ConflictException('TASK_SESSION_INACTIVE');
    }
    if (current.currentState === HandheldSessionState.INACTIVE_OFFLINE) {
      await tx.handheldTaskInterval.create({
        data: { taskSessionId, startedAt: new Date() },
      });
    }
    const receipt = await tx.handheldCommandReceipt.create({
      data: this.receiptData(
        taskSessionId,
        employeeId,
        dto,
        HandheldResultStatus.ACCEPTED,
        'SCAN_ACCEPTED',
        this.acceptedMessage(dto),
        this.deliveryExceptionFlags(dto),
        domainPackageEventId,
      ),
    });
    const event = await tx.handheldTaskSessionEvent.create({
      data: {
        taskSessionId,
        eventType: HandheldSessionEventType.OPERATIONAL_ACTIVITY_ACCEPTED,
        correlationId: dto.clientEventId,
        payload: {
          action: dto.action,
          clientEventId: dto.clientEventId,
          receiptId: receipt.id,
        },
      },
    });
    const [trailer, route, truck] = await Promise.all([
      dto.trailerBarcode
        ? tx.trailerSnapshot.findUnique({
            where: { trailerBarcode: dto.trailerBarcode },
            select: { id: true },
          })
        : null,
      dto.routeCode
        ? tx.route.findUnique({
            where: { routeNumber: dto.routeCode },
            select: { id: true },
          })
        : null,
      dto.truckUnitNumber
        ? tx.truck.findUnique({
            where: { unitNumber: dto.truckUnitNumber },
            select: { id: true },
          })
        : null,
    ]);
    await tx.handheldTaskSessionSnapshot.update({
      where: { id: taskSessionId },
      data: {
        currentState: HandheldSessionState.ACTIVE,
        networkState: dto.networkStateAtCapture,
        lastAcceptedActivityAt: event.createdAt,
        ...(trailer && { selectedTrailerId: trailer.id }),
        ...(route && { selectedRouteId: route.id }),
        ...(truck && { selectedTruckId: truck.id }),
      },
    });
    return receipt;
  }

  private receiptData(
    taskSessionId: string,
    employeeId: string,
    dto: HandheldScanDto,
    resultStatus: HandheldResultStatus,
    code: string,
    message: string,
    exceptionFlags: string[],
    domainPackageEventId?: string,
  ): Prisma.HandheldCommandReceiptUncheckedCreateInput {
    return {
      clientEventId: dto.clientEventId,
      taskSessionId,
      employeeId,
      action: dto.action,
      resultStatus,
      code,
      message,
      deviceId: dto.deviceId,
      deviceTimestamp: new Date(dto.deviceTimestamp),
      networkStateAtCapture: dto.networkStateAtCapture,
      trackingNumber: dto.trackingNumber,
      containerBarcode: dto.containerBarcode,
      trailerBarcode: dto.trailerBarcode,
      routeCode: dto.routeCode,
      truckUnitNumber: dto.truckUnitNumber,
      latitude: dto.latitude,
      longitude: dto.longitude,
      gpsAccuracyMetres: dto.gpsAccuracyMetres,
      gpsCapturedAt: dto.gpsCapturedAt
        ? new Date(dto.gpsCapturedAt)
        : undefined,
      exceptionFlags,
      domainPackageEventId,
    };
  }

  private deliveryExceptionFlags(dto: HandheldScanDto) {
    if (
      !(<HandheldAction[]>[
        HandheldAction.PACKAGE_OUT_FOR_DELIVERY,
        HandheldAction.PACKAGE_DELIVERED,
        HandheldAction.PACKAGE_ATTEMPTED_DELIVERY,
        HandheldAction.PACKAGE_DAMAGED,
        HandheldAction.PACKAGE_MISROUTED,
        HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
      ]).includes(dto.action)
    ) {
      return dto.exceptionFlags ?? [];
    }
    const flags = new Set(dto.exceptionFlags ?? []);
    if (dto.latitude === undefined || dto.longitude === undefined) {
      flags.add('GPS_MISSING');
    } else if (
      dto.gpsAccuracyMetres !== undefined &&
      dto.gpsAccuracyMetres > this.lowAccuracyMetres
    ) {
      flags.add('GPS_LOW_ACCURACY');
    }
    return [...flags];
  }

  private errorOutcome(error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Handheld command rejected';
    const explicitCode = message.match(/^[A-Z][A-Z0-9_]+$/)?.[0];
    if (explicitCode) return { code: explicitCode, message };
    if (error instanceof NotFoundException) {
      const subject = message.split(' ')[0]?.toUpperCase() ?? 'RESOURCE';
      return { code: `${subject}_NOT_FOUND`, message };
    }
    const businessCodes: Array<[RegExp, string]> = [
      [/already assigned to a trailer/i, 'PACKAGE_ALREADY_LOADED'],
      [/already assigned to a container/i, 'PACKAGE_ALREADY_LOADED'],
      [/same terminal/i, 'TERMINAL_MISMATCH'],
      [/only open containers/i, 'CONTAINER_NOT_OPEN'],
      [/container already assigned/i, 'CONTAINER_ALREADY_ON_TRAILER'],
      [/not assigned to this trailer/i, 'PACKAGE_WRONG_TRAILER'],
      [/not assigned to this container/i, 'PACKAGE_WRONG_CONTAINER'],
      [/invalid transition/i, 'INVALID_PACKAGE_STATE'],
    ];
    const mapped = businessCodes.find(([pattern]) => pattern.test(message));
    if (mapped) return { code: mapped[1], message };
    if (error instanceof HttpException) {
      return { code: 'BUSINESS_RULE_REJECTED', message };
    }
    return { code: 'HANDHELD_COMMAND_FAILED', message };
  }

  private duplicateResult<
    T extends {
      id: string;
      resultStatus: HandheldResultStatus;
      domainPackageEventId?: string | null;
    },
  >(
    receipt: T,
  ) {
    return this.presentReceipt({
      ...receipt,
      resultStatus:
        receipt.resultStatus === HandheldResultStatus.ACCEPTED
          ? HandheldResultStatus.DUPLICATE_ACCEPTED
          : receipt.resultStatus,
    });
  }

  private presentReceipt<
    T extends {
      id: string;
      resultStatus: HandheldResultStatus;
      domainPackageEventId?: string | null;
    },
  >(receipt: T) {
    return {
      ...receipt,
      status: receipt.resultStatus,
      serverEventId: receipt.domainPackageEventId ?? receipt.id,
    };
  }

  private async recordDuplicate(receiptId: string) {
    const receipt = await this.prisma.handheldCommandReceipt.update({
      where: { id: receiptId },
      data: { duplicateCount: { increment: 1 } },
    });
    return this.duplicateResult(receipt);
  }

  private inverseAction(action: HandheldAction) {
    const inverse: Partial<Record<HandheldAction, HandheldAction>> = {
      LOAD_PACKAGE_TO_TRAILER: HandheldAction.UNLOAD_PACKAGE_FROM_TRAILER,
      UNLOAD_PACKAGE_FROM_TRAILER: HandheldAction.LOAD_PACKAGE_TO_TRAILER,
      LOAD_PACKAGE_TO_CONTAINER: HandheldAction.UNLOAD_PACKAGE_FROM_CONTAINER,
      UNLOAD_PACKAGE_FROM_CONTAINER: HandheldAction.LOAD_PACKAGE_TO_CONTAINER,
      LOAD_CONTAINER_TO_TRAILER: HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER,
      UNLOAD_CONTAINER_FROM_TRAILER: HandheldAction.LOAD_CONTAINER_TO_TRAILER,
      LOAD_PACKAGE_TO_ROUTE: HandheldAction.REMOVE_PACKAGE_FROM_ROUTE,
      REMOVE_PACKAGE_FROM_ROUTE: HandheldAction.LOAD_PACKAGE_TO_ROUTE,
      PACKAGE_OUT_FOR_DELIVERY:
        HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
      PACKAGE_DELIVERED: HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
      PACKAGE_ATTEMPTED_DELIVERY:
        HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
      PACKAGE_DAMAGED: HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
      PACKAGE_MISROUTED: HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
    };
    const result = inverse[action];
    if (!result) throw new ConflictException('ORIGINAL_EVENT_NOT_REVERSIBLE');
    return result;
  }

  private validateActionForTask(
    taskType: HandheldTaskType,
    action: HandheldAction,
  ) {
    const actions: Record<HandheldTaskType, HandheldAction[]> = {
      TRAILER_LOAD: [
        HandheldAction.LOAD_PACKAGE_TO_TRAILER,
        HandheldAction.UNLOAD_PACKAGE_FROM_TRAILER,
        HandheldAction.LOAD_CONTAINER_TO_TRAILER,
        HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER,
        HandheldAction.CLOSE_TRAILER,
        HandheldAction.REVERSE_EVENT,
      ],
      TRAILER_UNLOAD: [
        HandheldAction.UNLOAD_PACKAGE_FROM_TRAILER,
        HandheldAction.LOAD_PACKAGE_TO_TRAILER,
        HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER,
        HandheldAction.LOAD_CONTAINER_TO_TRAILER,
        HandheldAction.REVERSE_EVENT,
      ],
      CONTAINER_LOAD: [
        HandheldAction.LOAD_PACKAGE_TO_CONTAINER,
        HandheldAction.UNLOAD_PACKAGE_FROM_CONTAINER,
        HandheldAction.CLOSE_CONTAINER,
        HandheldAction.REVERSE_EVENT,
      ],
      CONTAINER_UNLOAD: [
        HandheldAction.UNLOAD_PACKAGE_FROM_CONTAINER,
        HandheldAction.LOAD_PACKAGE_TO_CONTAINER,
        HandheldAction.REVERSE_EVENT,
      ],
      LAST_MILE_LOADING: [
        HandheldAction.LOAD_PACKAGE_TO_ROUTE,
        HandheldAction.REMOVE_PACKAGE_FROM_ROUTE,
        HandheldAction.REVERSE_EVENT,
      ],
      COURIER_DELIVERY: [
        HandheldAction.PACKAGE_OUT_FOR_DELIVERY,
        HandheldAction.PACKAGE_DELIVERED,
        HandheldAction.PACKAGE_ATTEMPTED_DELIVERY,
        HandheldAction.PACKAGE_DAMAGED,
        HandheldAction.PACKAGE_MISROUTED,
        HandheldAction.PACKAGE_RETURNED_TO_TERMINAL,
        HandheldAction.REVERSE_EVENT,
      ],
    };
    if (!actions[taskType].includes(action)) {
      throw new BadRequestException('ACTION_NOT_ALLOWED_FOR_TASK');
    }
  }

  private required(value: string | undefined, field: string) {
    if (!value?.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim().toUpperCase();
  }

  private acceptedMessage(dto: HandheldScanDto) {
    const context =
      dto.containerBarcode ??
      dto.trailerBarcode ??
      dto.routeCode ??
      dto.truckUnitNumber;
    return `${dto.action} accepted${context ? ` for ${context}` : ''}`;
  }

  private authorizedTasks(roles: string[]) {
    const normalized = roles.map((role) => role.toUpperCase());
    if (normalized.includes('ADMIN') || normalized.includes('SUPERVISOR')) {
      return ['TRAILER_OPERATIONS', 'LAST_MILE_LOADING', 'COURIER_DELIVERY'];
    }
    if (normalized.includes('DRIVER') || normalized.includes('COURIER')) {
      return ['LAST_MILE_LOADING', 'COURIER_DELIVERY'];
    }
    return ['TRAILER_OPERATIONS', 'LAST_MILE_LOADING'];
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
