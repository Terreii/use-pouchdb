import { useState, useEffect, useMemo } from 'react'

import usePouch from './usePouch'

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
  const pouch = usePouch()

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
      setState(EQueryState.loading)

      try {
        const result = await pouch.query(fun, opts)
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

    let subscription: PouchDB.Core.Changes<any>

    if (typeof fun === 'string') {
      subscription = pouch
        .changes({
          live: true,
          since: 'now',
          filter: '_view',
          view: fun,
        })
        .on('change', query)
    } else {
      subscription = pouch
        .changes({
          live: true,
          since: 'now',
          filter: doc => {
            let isDocInView: boolean = false

            const viewFunction = fun as {
              map: (doc: any, emit: (key: any, value?: any) => void) => void
            }
            viewFunction.map(doc, (_key: any, _value?: any) => {
              isDocInView = true
            })

            return isDocInView
          },
        })
        .on('change', query)
    }

    return () => {
      isMounted = false
      subscription.cancel()
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
