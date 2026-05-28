import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  PackageEventType,
  PackageStatus,
} from '@prisma/client';

// Handles operational lifecycle transition validation
@Injectable()
export class PackageTransitionValidator {

  // Validate whether a status transition is allowed
  validateTransition(
    currentStatus: PackageStatus,
    nextEvent: PackageEventType,
  ) {

    // Allowed operational transitions
    const validTransitions: Record<
      PackageStatus,
      PackageEventType[]
    > = {
      CREATED: [
        PackageEventType.PACKAGE_RECEIVED,
      ],

      RECEIVED: [
        PackageEventType.PACKAGE_IN_TRANSIT,
      ],

      IN_TRANSIT: [
        PackageEventType.PACKAGE_DELIVERED,
      ],

      DELIVERED: [],
    };

    // Reject invalid lifecycle transitions
    if (
      !validTransitions[currentStatus]?.includes(nextEvent)
    ) {
      throw new BadRequestException(
        `Invalid transition from ${currentStatus} using ${nextEvent}`,
      );
    }
  }
}