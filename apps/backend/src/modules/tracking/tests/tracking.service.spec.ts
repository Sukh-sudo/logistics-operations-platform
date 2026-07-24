import { ShipmentStatus } from '@prisma/client';

import { TrackingService } from '../services/tracking.service';

describe('TrackingService', () => {
  const terminal = {
    terminalCode: 'YEG',
    name: 'Edmonton-000',
    city: 'Edmonton',
    province: 'Alberta',
    country: 'Canada',
  };
  const prisma = {
    shipment: { findUnique: jest.fn() },
    terminal: { findUnique: jest.fn() },
  };
  let service: TrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrackingService(prisma as never);
  });

  it('returns a customer-safe snapshot projection', async () => {
    prisma.shipment.findUnique.mockResolvedValue({
      id: 'internal-id',
      shipmentNumber: 'SHIP-1',
      referenceNumber: 'ORDER-1',
      notificationRecipient: 'private@example.com',
      originTerminal: terminal,
      destinationTerminal: { ...terminal, terminalCode: 'YYC' },
      snapshot: {
        currentStatus: ShipmentStatus.IN_TRANSIT,
        currentTerminalId: 1,
        packageCount: 1,
        deliveredPackages: 0,
        outForDeliveryPackages: 1,
        remainingPackages: 1,
        progressPercent: 0,
        completedAt: null,
        lastActivityAt: new Date(),
      },
      packages: [
        {
          package: {
            trackingNumber: 'CON1234567',
            currentStatus: 'OUT_FOR_DELIVERY',
            updatedAt: new Date(),
          },
        },
      ],
      events: [
        {
          eventType: 'SHIPMENT_OUT_FOR_DELIVERY',
          createdAt: new Date(),
        },
      ],
    });
    prisma.terminal.findUnique.mockResolvedValue(terminal);

    const result = await service.trackShipment(' ship-1 ');

    expect(prisma.shipment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shipmentNumber: 'SHIP-1' } }),
    );
    expect(result.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(result.progress.outForDeliveryPackages).toBe(1);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('notificationRecipient');
  });
});
