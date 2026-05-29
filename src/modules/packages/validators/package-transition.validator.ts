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
      ],

      OUT_FOR_DELIVERY: [
        PackageEventType.PACKAGE_DELIVERED,
      ],

      DELIVERED: [],
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