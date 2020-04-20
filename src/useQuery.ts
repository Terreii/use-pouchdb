import { useContext, useState, useEffect, useMemo } from 'react'

import { PouchContext } from './context'

enum EQueryState {
  loading,
  done,
  error,
}

export type QueryState = 'loading' | 'done' | 'error'

export interface QueryResponse<Result> extends PouchDB.Query.Response<Result> {
  state: QueryState
  error: PouchDB.Core.Error | null
  loading: boolean
}

export default function useQuery<Content extends {}, Result, Model = Content>(
  fun: string | PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
  opts?: PouchDB.Query.Options<Model, Result>
): QueryResponse<Result> {
  const pouch = useContext(PouchContext)

  const [result, setResult] = useState<PouchDB.Query.Response<Result>>(() => ({
    rows: [],
    total_rows: 0,
    offset: 0,
  }))
  const [state, setState] = useState<EQueryState>(EQueryState.loading)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const query = async () => {
      if (pouch?.query == null) {
        setState(EQueryState.error)
        setError(
          new TypeError(
            'db.query() is not defined. Please install "pouchdb-mapreduce"'
          )
        )
        return
      }

      setState(EQueryState.loading)

      try {
        const result = await pouch?.query(fun, opts)!
        if (isMounted) {
          setState(EQueryState.done)
          setError(null)
          setResult(result)
        }
      } catch (error) {
        if (isMounted) {
          setState(EQueryState.error)
          setError(error)
        }
      }
    }

    query()

    return () => {
      isMounted = false
    }
  }, [fun])

  const returnObject = useMemo(
    () => ({
      ...result,
      state: EQueryState[state] as QueryState,
      error,
      loading: state === EQueryState.loading,
    }),
    [result, state, error]
  )

  if (typeof pouch?.query !== 'function') {
    throw new TypeError(
      'db.query() is not defined. Please install "pouchdb-mapreduce"'
    )
  }

  return returnObject
}
