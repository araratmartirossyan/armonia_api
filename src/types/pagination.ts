export type SortDir = 'ASC' | 'DESC'

export type PickSortResult<T extends string> = {
  sortBy: T
  sortDir: SortDir
}

export type BuildMetaParams = {
  page: number
  pageSize: number
  totalItems: number
  sortBy: string
  sortDir: SortDir
}

export type BuildMetaResult = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  sortBy: string
  sortDir: SortDir
}
