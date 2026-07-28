export type HandheldTaskType =
  | 'TRAILER_LOAD'
  | 'TRAILER_UNLOAD'
  | 'CONTAINER_LOAD'
  | 'CONTAINER_UNLOAD'
  | 'LAST_MILE_LOADING'
  | 'COURIER_DELIVERY';

export type HandheldResultStatus =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DUPLICATE_ACCEPTED'
  | 'REVERSED';

export interface HandheldScanCommand {
  taskSessionId: string;
  clientEventId: string;
  action: string;
  deviceId: string;
  deviceTimestamp: string;
  networkStateAtCapture: 'ONLINE' | 'OFFLINE_NETWORK';
  trackingNumber?: string;
  containerBarcode?: string;
  trailerBarcode?: string;
  routeCode?: string;
  truckUnitNumber?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracyMetres?: number;
  gpsCapturedAt?: string;
  exceptionFlags?: string[];
}

export interface HandheldCommandResult {
  clientEventId: string;
  id: string;
  serverEventId: string;
  status: HandheldResultStatus;
  code: string;
  message: string;
  serverReceivedAt: string;
  exceptionFlags: string[];
}
