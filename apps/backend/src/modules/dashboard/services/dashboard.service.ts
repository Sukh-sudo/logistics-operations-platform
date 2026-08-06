import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ContainerStatus,
  PackageStatus,
  Prisma,
  TrailerStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DashboardQueryDto } from '../dto/dashboard-query.dto';
import { HandheldDashboardQueryDto } from '../dto/handheld-dashboard-query.dto';
import { PackageListQueryDto } from '../dto/package-list-query.dto';
import { ContainerListQueryDto } from '../dto/container-list-query.dto';
import { TrailerListQueryDto } from '../dto/trailer-list-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getHandheldKpis(filters: HandheldDashboardQueryDto = {}) {
    const sessions = await this.prisma.handheldTaskSession.findMany({
      where: this.handheldSessionWhere(filters),
      include: { snapshot: true, intervals: true },
    });
    const sessionIds = sessions.map((session) => session.id);
    const receiptWhere: Prisma.HandheldCommandReceiptWhereInput = {
      taskSessionId: { in: sessionIds },
      ...(filters.action && { action: filters.action }),
      ...(this.handheldDateRange(filters) && {
        serverReceivedAt: this.handheldDateRange(filters),
      }),
    };
    const grouped = await this.prisma.handheldCommandReceipt.groupBy({
      by: ['resultStatus'],
      where: receiptWhere,
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      grouped.map((item) => [item.resultStatus, item._count._all]),
    );
    const productiveActions = [
      'LOAD_PACKAGE_TO_TRAILER',
      'UNLOAD_PACKAGE_FROM_TRAILER',
      'LOAD_PACKAGE_TO_CONTAINER',
      'UNLOAD_PACKAGE_FROM_CONTAINER',
      'LOAD_PACKAGE_TO_ROUTE',
      'REMOVE_PACKAGE_FROM_ROUTE',
      'PACKAGE_OUT_FOR_DELIVERY',
      'PACKAGE_DELIVERED',
      'PACKAGE_ATTEMPTED_DELIVERY',
      'PACKAGE_DAMAGED',
      'PACKAGE_MISROUTED',
      'PACKAGE_RETURNED_TO_TERMINAL',
    ] as const;
    const productivePackages =
      sessionIds.length === 0
        ? 0
        : await this.prisma.handheldCommandReceipt.count({
            where: {
              ...receiptWhere,
              action: { in: [...productiveActions] },
              resultStatus: 'ACCEPTED',
              reversedAt: null,
            },
          });
    const duplicateAggregate =
      sessionIds.length === 0
        ? { _sum: { duplicateCount: null } }
        : await this.prisma.handheldCommandReceipt.aggregate({
            where: receiptWhere,
            _sum: { duplicateCount: true },
          });
    const [
      damagedPackages,
      misroutedPackages,
      gpsMissingEvents,
      synchronizationFailures,
      closedContainersNotLoaded,
    ] = await Promise.all([
      this.prisma.handheldCommandReceipt.count({
        where: {
          ...receiptWhere,
          action: 'PACKAGE_DAMAGED',
          resultStatus: 'ACCEPTED',
          reversedAt: null,
        },
      }),
      this.prisma.handheldCommandReceipt.count({
        where: {
          ...receiptWhere,
          action: 'PACKAGE_MISROUTED',
          resultStatus: 'ACCEPTED',
          reversedAt: null,
        },
      }),
      this.prisma.handheldCommandReceipt.count({
        where: { ...receiptWhere, exceptionFlags: { has: 'GPS_MISSING' } },
      }),
      this.prisma.handheldCommandReceipt.count({
        where: { ...receiptWhere, code: 'SYNC_TRANSPORT_FAILURE' },
      }),
      this.prisma.containerSnapshot.count({
        where: {
          currentStatus: 'CLOSED',
          currentTrailerId: null,
          ...(filters.terminalId !== undefined && {
            currentTerminalId: filters.terminalId,
          }),
        },
      }),
    ]);
    const activeSeconds = sessions.reduce(
      (total, session) =>
        total +
        session.intervals.reduce((intervalTotal, interval) => {
          const end = interval.endedAt ?? new Date();
          return (
            intervalTotal +
            Math.max(0, end.getTime() - interval.startedAt.getTime()) / 1000
          );
        }, 0),
      0,
    );
    return {
      acceptedPackages: productivePackages,
      rejectedScans: counts.REJECTED ?? 0,
      duplicateScans: duplicateAggregate._sum.duplicateCount ?? 0,
      reversals: counts.REVERSED ?? 0,
      damagedPackages,
      misroutedPackages,
      gpsMissingEvents,
      synchronizationFailures,
      closedContainersNotLoaded,
      activeEmployees: new Set(
        sessions
          .filter((item) => item.snapshot?.currentState === 'ACTIVE')
          .map((item) => item.employeeId),
      ).size,
      operationallyInactiveEmployees: new Set(
        sessions
          .filter((item) => item.snapshot?.currentState === 'INACTIVE_OFFLINE')
          .map((item) => item.employeeId),
      ).size,
      activeSeconds,
      terminalPackagesPerHour:
        activeSeconds > 0
          ? Number((productivePackages / (activeSeconds / 3600)).toFixed(2))
          : 0,
    };
  }

  getHandheldEmployees(filters: HandheldDashboardQueryDto = {}) {
    return this.prisma.handheldTaskSession.findMany({
      where: this.handheldSessionWhere(filters),
      include: {
        employee: { include: { snapshot: true } },
        snapshot: true,
        intervals: true,
        commands: {
          where: {
            ...(filters.action && { action: filters.action }),
            ...(this.handheldDateRange(filters) && {
              serverReceivedAt: this.handheldDateRange(filters),
            }),
          },
          orderBy: { serverReceivedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getHandheldExceptions(filters: HandheldDashboardQueryDto = {}) {
    return this.prisma.handheldCommandReceipt.findMany({
      where: {
        taskSession: this.handheldSessionWhere(filters),
        ...(filters.action && { action: filters.action }),
        OR: [
          { resultStatus: 'REJECTED' },
          { exceptionFlags: { isEmpty: false } },
        ],
        ...(this.handheldDateRange(filters) && {
          serverReceivedAt: this.handheldDateRange(filters),
        }),
      },
      orderBy: { serverReceivedAt: 'desc' },
    });
  }

  getClosedContainersNotLoaded(filters: HandheldDashboardQueryDto = {}) {
    return this.prisma.containerSnapshot.findMany({
      where: {
        currentStatus: 'CLOSED',
        currentTrailerId: null,
        ...(filters.terminalId !== undefined && {
          currentTerminalId: filters.terminalId,
        }),
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  private handheldSessionWhere(
    filters: HandheldDashboardQueryDto,
  ): Prisma.HandheldTaskSessionWhereInput {
    return {
      ...(filters.terminalId !== undefined && {
        terminalId: filters.terminalId,
      }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.taskType && { taskType: filters.taskType }),
      ...(filters.deviceId && { deviceId: filters.deviceId }),
      ...(this.handheldDateRange(filters) && {
        createdAt: this.handheldDateRange(filters),
      }),
    };
  }

  private handheldDateRange(
    filters: HandheldDashboardQueryDto,
  ): Prisma.DateTimeFilter | undefined {
    if (!filters.from && !filters.to) return undefined;
    return {
      ...(filters.from && { gte: new Date(filters.from) }),
      ...(filters.to && { lte: new Date(filters.to) }),
    };
  }

  async getSummary(filters: DashboardQueryDto = {}) {
    const snapshotDate = this.getInclusiveDateRange(filters);
    const snapshotWhere = {
      ...(snapshotDate && { updatedAt: snapshotDate }),
      ...(filters.terminalId !== undefined && {
        currentTerminalId: filters.terminalId,
      }),
    };

    // A selected status leaves the other status buckets at zero while keeping
    // the response shape stable for cards and charts in the dashboard client.
    const countPackages = (currentStatus: PackageStatus) =>
      filters.packageStatus && filters.packageStatus !== currentStatus
        ? Promise.resolve(0)
        : this.prisma.packageSnapshot.count({
            where: { ...snapshotWhere, currentStatus },
          });
    const countTrailers = (currentStatus: TrailerStatus) =>
      filters.trailerStatus && filters.trailerStatus !== currentStatus
        ? Promise.resolve(0)
        : this.prisma.trailerSnapshot.count({
            where: { ...snapshotWhere, currentStatus },
          });

    const [
      received,
      sorted,
      inContainer,
      inTrailer,
      departed,
      arrived,
      outForDelivery,
      delivered,
      attemptedDelivery,
      damaged,
      misrouted,
      returnedToTerminal,

      openContainers,
      closedContainers,
      loadedContainers,

      openTrailers,
      closedTrailers,
      inTransitTrailers,
      arrivedTrailers,
    ] = await Promise.all([
      countPackages(PackageStatus.RECEIVED),
      countPackages(PackageStatus.SORTED),
      countPackages(PackageStatus.IN_CONTAINER),
      countPackages(PackageStatus.IN_TRAILER),
      countPackages(PackageStatus.DEPARTED),
      countPackages(PackageStatus.ARRIVED),
      countPackages(PackageStatus.OUT_FOR_DELIVERY),
      countPackages(PackageStatus.DELIVERED),
      countPackages(PackageStatus.ATTEMPTED_DELIVERY),
      countPackages(PackageStatus.DAMAGED),
      countPackages(PackageStatus.MISROUTED),
      countPackages(PackageStatus.RETURNED_TO_TERMINAL),

      // Container counts
      this.prisma.containerSnapshot.count({
        where: {
          ...snapshotWhere,
          currentStatus: ContainerStatus.OPEN,
        },
      }),

      this.prisma.containerSnapshot.count({
        where: {
          ...snapshotWhere,
          currentStatus: ContainerStatus.CLOSED,
        },
      }),

      this.prisma.containerSnapshot.count({
        where: {
          ...snapshotWhere,
          currentStatus: ContainerStatus.OPEN,
          packageCount: {
            gt: 0,
          },
        },
      }),

      countTrailers(TrailerStatus.OPEN),
      countTrailers(TrailerStatus.CLOSED),
      countTrailers(TrailerStatus.IN_TRANSIT),
      countTrailers(TrailerStatus.ARRIVED),
    ]);

    return {
      packages: {
        received,
        sorted,
        inContainer,
        inTrailer,
        departed,
        arrived,
        outForDelivery,
        delivered,
        attemptedDelivery,
        damaged,
        misrouted,
        returnedToTerminal,
      },

      containers: {
        open: openContainers,
        closed: closedContainers,
        loaded: loadedContainers,
      },

      trailers: {
        open: openTrailers,
        closed: closedTrailers,
        inTransit: inTransitTrailers,
        arrived: arrivedTrailers,
      },
    };
  }

  async getTrailers(filters: TrailerListQueryDto = {}) {
  const snapshotDate = this.getInclusiveDateRange(filters);
  const lane = this.shipmentLane(filters);
  let laneTrailerIds: string[] | undefined;
  if (lane) {
    const lanePackages = await this.prisma.packageSnapshot.findMany({
      where: {
        OR: [{ currentTrailerId: { not: null } }, { currentContainerId: { not: null } }],
        aggregate: { shipmentPackages: { some: { shipment: lane } } },
      },
      select: { currentTrailerId: true, currentContainerId: true },
    });
    const currentContainerIds = lanePackages.flatMap((pkg) => pkg.currentContainerId ? [pkg.currentContainerId] : []);
    const containerLocations = currentContainerIds.length
      ? await this.prisma.containerSnapshot.findMany({
          where: { id: { in: currentContainerIds }, currentTrailerId: { not: null } },
          select: { currentTrailerId: true },
        })
      : [];
    laneTrailerIds = [...new Set([
      ...lanePackages.flatMap((pkg) => pkg.currentTrailerId ? [pkg.currentTrailerId] : []),
      ...containerLocations.flatMap((container) => container.currentTrailerId ? [container.currentTrailerId] : []),
    ])];
  }
  const trailers =
    await this.prisma.trailerSnapshot.findMany({
      where: {
        ...(snapshotDate && { updatedAt: snapshotDate }),
        ...(filters.status && { currentStatus: filters.status }),
        ...(laneTrailerIds && { id: { in: laneTrailerIds } }),
      },
      orderBy: {
        trailerBarcode: 'asc',
      },
    });

  return Promise.all(
    trailers.map(async (trailer) => {
      const containerCount =
        await this.prisma.containerSnapshot.count({
          where: {
            currentTrailerId: trailer.id,
          },
        });

      const loosePackageCount =
        await this.prisma.packageSnapshot.count({
          where: {
            currentTrailerId: trailer.id,
          },
        });

      const containerIds =
        (
          await this.prisma.containerSnapshot.findMany({
            where: {
              currentTrailerId: trailer.id,
            },
            select: {
              id: true,
            },
          })
        ).map((c) => c.id);

      const containerPackageCount =
        containerIds.length > 0
          ? await this.prisma.packageSnapshot.count({
              where: {
                currentContainerId: {
                  in: containerIds,
                },
              },
            })
          : 0;

      return {
        trailerBarcode: trailer.trailerBarcode,
        status: trailer.currentStatus,
        containerCount,
        packageCount:
          loosePackageCount + containerPackageCount,
      };
    }),
  );
}

// Returns all containers for the operations dashboard
async getContainers(filters: ContainerListQueryDto = {}) {
  const snapshotDate = this.getInclusiveDateRange(filters);
  const lane = this.shipmentLane(filters);
  const laneContainerIds = lane
    ? (await this.prisma.packageSnapshot.findMany({
        where: {
          currentContainerId: { not: null },
          aggregate: { shipmentPackages: { some: { shipment: lane } } },
        },
        select: { currentContainerId: true },
        distinct: ['currentContainerId'],
      })).flatMap((pkg) => pkg.currentContainerId ? [pkg.currentContainerId] : [])
    : undefined;
  // Fetch all container snapshots
  const containers =
    await this.prisma.containerSnapshot.findMany({
      where: {
        ...(snapshotDate && { updatedAt: snapshotDate }),
        ...(filters.status && { currentStatus: filters.status }),
        ...(laneContainerIds && { id: { in: laneContainerIds } }),
      },
      orderBy: {
        containerBarcode: 'asc',
      },
    });

  return Promise.all(
    containers.map(async (container) => {
      let assignedTrailer: string | null = null;

      // If the container is assigned to a trailer,
      // retrieve the trailer barcode.
      if (container.currentTrailerId) {
        const trailer =
          await this.prisma.trailerSnapshot.findUnique({
            where: {
              id: container.currentTrailerId,
            },
            select: {
              trailerBarcode: true,
            },
          });

        assignedTrailer =
          trailer?.trailerBarcode ?? null;
      }

      return {
        containerBarcode: container.containerBarcode,
        status: container.currentStatus,
        packageCount: container.packageCount,
        assignedTrailer,
      };
    }),
  );
}

// Returns the most recent operational events across the system
// Returns the most recent activity across packages, containers and trailers
async getRecentEvents(filters: DashboardQueryDto = {}, limit = 25) {
  const eventDate = this.getInclusiveDateRange(filters);
  const packageSnapshotWhere: Prisma.PackageSnapshotWhereInput = {
    ...(filters.terminalId !== undefined && {
      currentTerminalId: filters.terminalId,
    }),
    ...(filters.packageStatus && { currentStatus: filters.packageStatus }),
  };
  const containerSnapshotWhere: Prisma.ContainerSnapshotWhereInput = {
    ...(filters.terminalId !== undefined && {
      currentTerminalId: filters.terminalId,
    }),
  };
  const trailerSnapshotWhere: Prisma.TrailerSnapshotWhereInput = {
    ...(filters.terminalId !== undefined && {
      currentTerminalId: filters.terminalId,
    }),
    ...(filters.trailerStatus && { currentStatus: filters.trailerStatus }),
  };

  // Get the latest package events
  const packageEvents =
    await this.prisma.packageEvent.findMany({
      where: {
        ...(eventDate && { createdAt: eventDate }),
        ...(Object.keys(packageSnapshotWhere).length > 0 && {
          package: { snapshot: packageSnapshotWhere },
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        package: {
          select: {
            trackingNumber: true,
          },
        },
      },
    });

  // Get the latest container events
  const containerEvents =
    await this.prisma.containerEvent.findMany({
      where: {
        ...(eventDate && { createdAt: eventDate }),
        ...(Object.keys(containerSnapshotWhere).length > 0 && {
          container: { snapshot: containerSnapshotWhere },
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        container: {
          select: {
            containerBarcode: true,
          },
        },
      },
    });

  // Get the latest trailer events
  const trailerEvents =
    await this.prisma.trailerEvent.findMany({
      where: {
        ...(eventDate && { createdAt: eventDate }),
        ...(Object.keys(trailerSnapshotWhere).length > 0 && {
          trailer: { snapshot: trailerSnapshotWhere },
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        trailer: {
          select: {
            trailerBarcode: true,
          },
        },
      },
    });

  // Combine everything into one timeline
  const events = [
    ...packageEvents.map((event) => ({
      assetType: 'PACKAGE',
      reference: event.package.trackingNumber,
      event: event.eventType,
      occurredAt: event.createdAt,
    })),

    ...containerEvents.map((event) => ({
      assetType: 'CONTAINER',
      reference: event.container.containerBarcode,
      event: event.eventType,
      occurredAt: event.createdAt,
    })),

    ...trailerEvents.map((event) => ({
      assetType: 'TRAILER',
      reference: event.trailer.trailerBarcode,
      event: event.eventType,
      occurredAt: event.createdAt,
    })),
  ];

  // Return the newest events first
  return events
    .sort(
      (a, b) =>
        b.occurredAt.getTime() -
        a.occurredAt.getTime(),
    )
    .slice(0, limit);
}

/**
 * Converts calendar-date filters to a half-open UTC range. Using the next
 * day's midnight for `lt` keeps the selected end date inclusive.
 */
private getInclusiveDateRange(
  filters: Pick<DashboardQueryDto, 'fromDate' | 'toDate'>,
): Prisma.DateTimeFilter | undefined {
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw new BadRequestException('fromDate must be on or before toDate');
  }

  if (!filters.fromDate && !filters.toDate) {
    return undefined;
  }

  const range: Prisma.DateTimeFilter = {};
  if (filters.fromDate) {
    range.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
  }
  if (filters.toDate) {
    const exclusiveEnd = new Date(`${filters.toDate}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.lt = exclusiveEnd;
  }
  return range;
}

private shipmentLane(filters: { originTerminalId?: number; destinationTerminalId?: number }) {
  if (filters.originTerminalId === undefined && filters.destinationTerminalId === undefined) return undefined;
  return {
    ...(filters.originTerminalId !== undefined && { originTerminalId: filters.originTerminalId }),
    ...(filters.destinationTerminalId !== undefined && { destinationTerminalId: filters.destinationTerminalId }),
  };
}

// Returns packages with their current operational location and shipment lane.
async getPackages(filters: PackageListQueryDto = {}) {
  const snapshotDate = this.getInclusiveDateRange(filters);
  const lane = {
    ...(filters.originTerminalId !== undefined && {
      originTerminalId: filters.originTerminalId,
    }),
    ...(filters.destinationTerminalId !== undefined && {
      destinationTerminalId: filters.destinationTerminalId,
    }),
  };
  const hasLaneFilter = Object.keys(lane).length > 0;
  const packages = await this.prisma.packageSnapshot.findMany({
    where: {
      ...(snapshotDate && { updatedAt: snapshotDate }),
      ...(filters.status && { currentStatus: filters.status }),
      ...(hasLaneFilter && {
        aggregate: {
          shipmentPackages: { some: { shipment: lane } },
        },
      }),
    },
    include: {
      aggregate: {
        select: {
          shipmentPackages: {
            take: 1,
            select: {
              shipment: {
                select: { originTerminalId: true, destinationTerminalId: true },
              },
            },
          },
        },
      },
    },
    orderBy: { trackingNumber: 'asc' },
  });

  const containerIds = packages.flatMap((pkg) => pkg.currentContainerId ? [pkg.currentContainerId] : []);
  const containers = containerIds.length
    ? await this.prisma.containerSnapshot.findMany({
        where: { id: { in: containerIds } },
        select: { id: true, containerBarcode: true, currentTrailerId: true },
      })
    : [];
  const containerById = new Map(containers.map((container) => [container.id, container]));
  const trailerIds = new Set(packages.flatMap((pkg) => pkg.currentTrailerId ? [pkg.currentTrailerId] : []));
  containers.forEach((container) => {
    if (container.currentTrailerId) trailerIds.add(container.currentTrailerId);
  });
  const trailers = trailerIds.size
    ? await this.prisma.trailerSnapshot.findMany({
        where: { id: { in: [...trailerIds] } },
        select: { id: true, trailerBarcode: true },
      })
    : [];
  const trailerById = new Map(trailers.map((trailer) => [trailer.id, trailer.trailerBarcode]));

  return packages.map((pkg) => {
    const container = pkg.currentContainerId ? containerById.get(pkg.currentContainerId) : undefined;
    const trailerId = pkg.currentTrailerId ?? container?.currentTrailerId ?? null;
    const shipment = pkg.aggregate.shipmentPackages[0]?.shipment;
    return {
      trackingNumber: pkg.trackingNumber,
      status: pkg.currentStatus,
      containerBarcode: container?.containerBarcode ?? null,
      trailerBarcode: trailerId ? trailerById.get(trailerId) ?? null : null,
      updatedAt: pkg.updatedAt.toISOString(),
      originTerminalId: shipment?.originTerminalId ?? null,
      destinationTerminalId: shipment?.destinationTerminalId ?? null,
    };
  });
}

}
