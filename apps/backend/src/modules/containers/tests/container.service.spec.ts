import { BadRequestException } from '@nestjs/common';
import { PackageStatus, PackageType } from '@prisma/client';
import { ContainerService } from '../services/container.service';

describe('ContainerService package-type compatibility', () => {
  it('rejects a mismatched package before writing events or snapshots', async () => {
    const tx = {
      containerSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'container-1',
          packageType: PackageType.CONVEYABLE,
        }),
        update: jest.fn(),
      },
      packageSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'package-1',
          trackingNumber: 'DG12345678',
          packageType: PackageType.DANGEROUS_GOODS,
          currentStatus: PackageStatus.RECEIVED,
          currentContainerId: null,
        }),
        update: jest.fn(),
      },
      packageEvent: { create: jest.fn() },
      packageContainerHistory: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new ContainerService(prisma as never);

    await expect(service.loadPackage('container-1', {
      trackingNumber: 'DG12345678',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.packageEvent.create).not.toHaveBeenCalled();
    expect(tx.packageSnapshot.update).not.toHaveBeenCalled();
    expect(tx.containerSnapshot.update).not.toHaveBeenCalled();
  });
});
