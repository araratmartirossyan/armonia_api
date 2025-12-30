import { z } from 'zod'
import { SortDir, PickSortResult, BuildMetaParams, BuildMetaResult } from '../types/pagination'

export function parsePaginationQuery(
  input: unknown,
  opts?: {
    defaultPageSize?: number
    maxPageSize?: number
    defaultSortDir?: SortDir
  },
) {
  const defaultPageSize = opts?.defaultPageSize ?? 20
  const maxPageSize = opts?.maxPageSize ?? 200
  const defaultSortDir = opts?.defaultSortDir ?? 'DESC'

  const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
    sortBy: z.string().trim().min(1).optional(),
    sortDir: z
      .string()
      .trim()
      .transform(v => v.toUpperCase())
      .pipe(z.enum(['ASC', 'DESC']))
      .default(defaultSortDir),
  })

  const parsed = paginationQuerySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error,
    }
  }
  const { page, pageSize, sortBy, sortDir } = parsed.data
  return {
    ok: true as const,
    page,
    pageSize,
    sortBy,
    sortDir: sortDir as SortDir,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

export function pickSort<T extends string>(
  sortByRaw: string | undefined,
  sortDir: SortDir,
  allowedSort: readonly T[],
  defaultSortBy: T,
): PickSortResult<T> {
  const sortBy = (
    sortByRaw && (allowedSort as readonly string[]).includes(sortByRaw) ? sortByRaw : defaultSortBy
  ) as T
  return { sortBy, sortDir }
}

export function buildMeta(params: BuildMetaParams): BuildMetaResult {
  const totalPages = Math.max(1, Math.ceil(params.totalItems / params.pageSize))
  return {
    page: params.page,
    pageSize: params.pageSize,
    totalItems: params.totalItems,
    totalPages,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  }
}
