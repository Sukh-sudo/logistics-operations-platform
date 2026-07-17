import { describe, expect, it } from 'vitest';
import type { EquipmentAssignmentDto } from '@logistics/shared-types';
import { assignmentsForDriver, assignmentsForTruck } from './assignmentHistory';

const assignment = { id: 'a1', status: 'ACTIVE', assignedAt: '2026-07-01T00:00:00Z', releasedAt: null, trip: { id: 't1', tripNumber: 'TRIP-1', status: 'CREATED' }, truck: { id: 'truck-1', unitNumber: 'TRK-1', licensePlate: 'ABC' }, driver: { id: 'driver-1', employeeId: 'DRV-1', licenseNumber: 'LIC' }, trailer: { id: 'trailer-1', trailerBarcode: 'TRL-1', currentStatus: 'OPEN' } } satisfies EquipmentAssignmentDto;

describe('fleet assignment history', () => {
  it('selects immutable history for the requested fleet asset', () => {
    expect(assignmentsForTruck([assignment], 'truck-1')).toEqual([assignment]);
    expect(assignmentsForDriver([assignment], 'other')).toEqual([]);
  });
});
