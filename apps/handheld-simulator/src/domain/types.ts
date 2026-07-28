export type NetworkState = 'ONLINE' | 'OFFLINE_NETWORK';
export type SessionState = 'ACTIVE' | 'PAUSED' | 'INACTIVE_OFFLINE' | 'COMPLETED';
export type SyncState =
  | 'PENDING'
  | 'PENDING_VALIDATION'
  | 'SYNCING'
  | 'ACCEPTED'
  | 'REJECTED_ACTION_REQUIRED'
  | 'DUPLICATE_ACCEPTED'
  | 'REVERSED'
  | 'DISMISSED_LOCAL';

export type TaskType =
  | 'TRAILER_LOAD'
  | 'TRAILER_UNLOAD'
  | 'CONTAINER_LOAD'
  | 'CONTAINER_UNLOAD'
  | 'LAST_MILE_LOADING'
  | 'COURIER_DELIVERY';

export type HandheldAction =
  | 'LOAD_PACKAGE_TO_TRAILER'
  | 'UNLOAD_PACKAGE_FROM_TRAILER'
  | 'LOAD_PACKAGE_TO_CONTAINER'
  | 'UNLOAD_PACKAGE_FROM_CONTAINER'
  | 'LOAD_CONTAINER_TO_TRAILER'
  | 'UNLOAD_CONTAINER_FROM_TRAILER'
  | 'CLOSE_CONTAINER'
  | 'CLOSE_TRAILER'
  | 'LOAD_PACKAGE_TO_ROUTE'
  | 'REMOVE_PACKAGE_FROM_ROUTE'
  | 'PACKAGE_OUT_FOR_DELIVERY'
  | 'PACKAGE_DELIVERED'
  | 'PACKAGE_ATTEMPTED_DELIVERY'
  | 'PACKAGE_DAMAGED'
  | 'PACKAGE_MISROUTED'
  | 'PACKAGE_RETURNED_TO_TERMINAL'
  | 'REVERSE_EVENT';

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface Terminal {
  id: number;
  terminalCode: string;
  name: string;
}

export interface SessionSnapshot {
  currentState: SessionState;
  networkState: NetworkState;
  lastAcceptedActivityAt?: string;
}

export interface WorkSession {
  id: string;
  taskType: TaskType;
  deviceId: string;
  terminalId: number;
  createdAt: string;
  snapshot: SessionSnapshot;
}

export interface Bootstrap {
  employee: Employee;
  terminal: Terminal;
  authorizedTasks: Array<
    'TRAILER_OPERATIONS' | 'LAST_MILE_LOADING' | 'COURIER_DELIVERY'
  >;
  activeSessions: WorkSession[];
  serverTime: string;
  apiVersion: string;
  configuration: {
    inactivityMinutes: number;
    gpsLowAccuracyThresholdMetres: number;
    localHistoryRetentionHours: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginResponse extends AuthTokens {
  employee: Employee;
  terminal: Terminal;
}

export interface ScanCommand {
  taskSessionId: string;
  clientEventId: string;
  action: HandheldAction;
  deviceId: string;
  deviceTimestamp: string;
  networkStateAtCapture: NetworkState;
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

export interface ScanResult {
  id: string;
  clientEventId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_ACCEPTED' | 'REVERSED';
  resultStatus: ScanResult['status'];
  serverEventId: string;
  code: string;
  message: string;
  serverReceivedAt?: string;
  exceptionFlags?: string[];
}

export interface OutboxEvent extends ScanCommand {
  syncState: SyncState;
  message: string;
  code?: string;
  serverEventId?: string;
  receiptId?: string;
  serverReceivedAt?: string;
  exceptionFlags: string[];
  retryCount: number;
  createdAt: string;
  resolvedAt?: string;
  originalClientEventId?: string;
}

export interface OperationalContext {
  trailerBarcode: string;
  routeCode: string;
  truckUnitNumber: string;
}

export interface PackageLookup {
  trackingNumber: string;
  postalCode?: string;
  routeCode?: string;
  currentStatus?: string;
  currentContainerBarcode?: string;
  currentTrailerBarcode?: string;
}
