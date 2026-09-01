import { API_SIGNATURE } from '../constants/api.constants';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
  signature: typeof API_SIGNATURE;
  timestamp: string;
  path?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}
