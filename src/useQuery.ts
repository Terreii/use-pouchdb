export type QueryState = 'loading' | 'done' | 'error'

export interface QueryResponse<Result> extends PouchDB.Query.Response<Result> {
  state: 'loading' | 'done' | 'error'
  error: Error | null
  loading: boolean
}

export default function useQuery() {}
