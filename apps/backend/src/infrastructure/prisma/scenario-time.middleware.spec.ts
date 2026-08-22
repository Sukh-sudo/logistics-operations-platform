import { Prisma } from '@prisma/client';
import { applyScenarioTime } from './scenario-time.middleware';

const params = (
  model: string,
  action: Prisma.PrismaAction,
  args: Record<string, unknown>,
): Prisma.MiddlewareParams => ({ model, action, args, dataPath: [], runInTransaction: true });

describe('applyScenarioTime', () => {
  const instant = new Date('2026-07-10T14:30:00.000Z');

  it('sets database-default and updated timestamps on creates', () => {
    const result = applyScenarioTime(
      params('Shipment', 'create', { data: { shipmentNumber: 'DEMO-1' } }),
      instant,
    );

    expect(result.args.data).toEqual({
      shipmentNumber: 'DEMO-1',
      createdAt: instant,
      updatedAt: instant,
    });
  });

  it('sets every createMany row to the scenario instant', () => {
    const result = applyScenarioTime(
      params('ShipmentPackage', 'createMany', {
        data: [
          { shipmentId: 'one', packageId: 'one' },
          { shipmentId: 'two', packageId: 'two' },
        ],
      }),
      instant,
    );

    expect(result.args.data).toEqual([
      { shipmentId: 'one', packageId: 'one', assignedAt: instant },
      { shipmentId: 'two', packageId: 'two', assignedAt: instant },
    ]);
  });

  it('overrides operation timestamps but preserves planned and device time', () => {
    const plannedDeparture = new Date('2026-07-12T10:00:00.000Z');
    const result = applyScenarioTime(
      params('Trip', 'update', {
        data: { actualDeparture: new Date(), plannedDeparture },
      }),
      instant,
    );

    expect(result.args.data).toEqual({
      actualDeparture: instant,
      plannedDeparture,
      updatedAt: instant,
    });
  });

  it('does not add fields to reads or unknown models', () => {
    const read = params('Shipment', 'findMany', { where: {} });
    const unknown = params('Unknown', 'create', { data: { value: 1 } });

    expect(applyScenarioTime(read, instant)).toEqual(read);
    expect(applyScenarioTime(unknown, instant).args.data).toEqual({ value: 1 });
  });
});
