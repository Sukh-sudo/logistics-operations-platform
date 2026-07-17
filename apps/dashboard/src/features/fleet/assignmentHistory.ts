import type { EquipmentAssignmentDto } from '@logistics/shared-types';

// Assignment records are immutable history; filtering them never reconstructs current state.
export const assignmentsForTruck = (items: EquipmentAssignmentDto[], truckId: string) =>
  items.filter((item) => item.truck.id === truckId);

export const assignmentsForDriver = (items: EquipmentAssignmentDto[], driverId: string) =>
  items.filter((item) => item.driver.id === driverId);
