export default function useAllDocs<Content extends {}, Model = Content>(
  _options?:
    | PouchDB.Core.AllDocsWithKeyOptions
    | PouchDB.Core.AllDocsWithKeysOptions
    | PouchDB.Core.AllDocsWithinRangeOptions
    | PouchDB.Core.AllDocsOptions
): PouchDB.Core.AllDocsResponse<Content & Model> & {
  loading: boolean
  state: 'loading' | 'done' | 'error'
  error: PouchDB.Core.Error | null
} {
  return {
    loading: true,
    state: 'loading',
    error: null,
    offset: 0,
    total_rows: 0,
    rows: [],
  }
}
