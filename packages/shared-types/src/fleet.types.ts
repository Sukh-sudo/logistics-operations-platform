export type TruckStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_SERVICE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type DriverStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_TRIP' | 'OFF_DUTY';
export type EquipmentAssignmentStatus = 'ACTIVE' | 'RELEASED';

export interface FleetSnapshotDto<TStatus> {
  currentStatus: TStatus;
  currentTerminalId: number | null;
  assignedTripId: string | null;
  lastActivityAt: string | null;
}

export interface TruckDto {
  id: string; unitNumber: string; licensePlate: string; status: TruckStatus;
  year: number | null; make: string | null; model: string | null;
  terminal: { id: number; terminalCode: string; name: string } | null;
  snapshot: FleetSnapshotDto<TruckStatus> | null;
}

export interface DriverDto {
  id: string; employeeId: string; licenseNumber: string; licenseClass: string; status: DriverStatus;
  terminal: { id: number; terminalCode: string; name: string } | null;
  snapshot: FleetSnapshotDto<DriverStatus> | null;
}

export interface EquipmentAssignmentDto {
  id: string; status: EquipmentAssignmentStatus; assignedAt: string; releasedAt: string | null;
  trip: { id: string; tripNumber: string; status: string };
  truck: Pick<TruckDto, 'id' | 'unitNumber' | 'licensePlate'>;
  driver: Pick<DriverDto, 'id' | 'employeeId' | 'licenseNumber'>;
  trailer: Pick<import('./trailer.types.js').TrailerSnapshotDto, 'id' | 'trailerBarcode' | 'currentStatus'> | null;
}

export interface FleetAvailabilityDto {
  trucks: TruckDto[];
  drivers: DriverDto[];
  trailers: import('./trailer.types.js').TrailerSnapshotDto[];
}
