import { PaginatedData, PaginationMeta } from '../interfaces/api-response.interface';

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function buildPaginatedData<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedData<T> {
  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
}
