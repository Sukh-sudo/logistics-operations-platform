export interface LoginRequestDto { email: string; password: string; }
export interface LoginResponseDto { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number; }
export interface AuthUserDto {
  userId: string;
  employeeNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  currentStatus: 'INACTIVE' | 'ACTIVE';
  roleNames: string[];
  permissions: string[];
  currentTerminalId: number | null;
}
