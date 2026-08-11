export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  tokenVersion: number;
  handheldDeviceId?: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  tokenVersion: number;
  type: 'access';
  handheldDeviceId?: string;
}
