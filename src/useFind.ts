import { ResultType } from './state-machine'

type options<T> =
  | PouchDB.Find.FindRequest<T>
  | (PouchDB.Find.FindRequest<T> & PouchDB.Find.CreateIndexOptions)

export default function useFind<Content>(
  _opt: options<Content>
): ResultType<PouchDB.Find.FindResponse<Content>> {
  return {
    docs: [],
    loading: false,
    state: 'loading',
    error: null,
  }
}
