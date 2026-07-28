import {BadRequestException, Injectable,} from '@nestjs/common';
import {PackageEventType,PackageStatus,} from '@prisma/client';

@Injectable()
export class PackageTransitionValidator {
  validateTransition(
    currentStatus: PackageStatus,
    nextEvent: PackageEventType,
  ) {

    const validTransitions: Record<
      PackageStatus,
      PackageEventType[]
    > = {

      RECEIVED: [
        PackageEventType.PACKAGE_SORTED,
      ],

      SORTED: [
        PackageEventType.PACKAGE_LOADED_TO_CONTAINER,
        PackageEventType.PACKAGE_LOADED_TO_TRAILER,
        PackageEventType.PACKAGE_LOADED_TO_LAST_MILE,
      ],

      IN_CONTAINER: [
        PackageEventType.PACKAGE_UNLOADED_FROM_CONTAINER,
        PackageEventType.PACKAGE_LOADED_TO_TRAILER,
      ],

      IN_TRAILER: [
        PackageEventType.PACKAGE_DEPARTED,
        PackageEventType.PACKAGE_UNLOADED_FROM_TRAILER,
      ],

      DEPARTED: [
        PackageEventType.PACKAGE_ARRIVED,
      ],

      ARRIVED: [
        PackageEventType.PACKAGE_OUT_FOR_DELIVERY,
        PackageEventType.PACKAGE_SORTED,
        PackageEventType.PACKAGE_LOADED_TO_LAST_MILE,
      ],

      OUT_FOR_DELIVERY: [
        PackageEventType.PACKAGE_DELIVERED,
        PackageEventType.PACKAGE_ATTEMPTED_DELIVERY,
        PackageEventType.PACKAGE_DAMAGED,
        PackageEventType.PACKAGE_MISROUTED,
        PackageEventType.PACKAGE_RETURNED_TO_TERMINAL,
      ],

      DELIVERED: [PackageEventType.PACKAGE_RETURNED_TO_TERMINAL],

      ATTEMPTED_DELIVERY: [
        PackageEventType.PACKAGE_OUT_FOR_DELIVERY,
        PackageEventType.PACKAGE_RETURNED_TO_TERMINAL,
      ],

      DAMAGED: [PackageEventType.PACKAGE_RETURNED_TO_TERMINAL],

      MISROUTED: [PackageEventType.PACKAGE_RETURNED_TO_TERMINAL],

      RETURNED_TO_TERMINAL: [PackageEventType.PACKAGE_SORTED],
    };

    const allowedEvents =
      validTransitions[currentStatus] ?? [];

    if (!allowedEvents.includes(nextEvent)) {
      throw new BadRequestException(
        `Invalid transition from ${currentStatus} using ${nextEvent}`,
      );
    }
  }
}
