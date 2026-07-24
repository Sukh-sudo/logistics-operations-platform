export interface ApiPaginationDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponseDto<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
  pagination?: ApiPaginationDto;
}

export interface ApiErrorResponseDto {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
  };
  timestamp: string;
  path: string;
  requestId?: string;
}
