import { useState, useEffect, useMemo } from 'react'
import { MISSING_DOC } from 'pouchdb-errors'

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

  const {
    reduce,
    include_docs,
    conflicts,
    attachments,
    binary,
    inclusive_end,
    limit,
    skip,
    descending,
    group,
    group_level,
  } = opts || {}

  const startkey = optionToString(opts?.startkey)
  const endkey = optionToString(opts?.endkey)
  const key = optionToString(opts?.key)
  const keys = optionToString(opts?.keys)

  const [result, setResult] = useState<PouchDB.Query.Response<Result>>(() => ({
    rows: [],
    total_rows: 0,
    offset: 0,
  }))
  const [state, setState] = useState<EQueryState>(EQueryState.loading)
  const [error, setError] = useState<PouchDB.Core.Error | null>(null)

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
    let ddocSubscription: PouchDB.Core.Changes<any> | null = null

    if (typeof fun === 'string') {
      subscription = pouch
        .changes({
          live: true,
          since: 'now',
          filter: '_view',
          view: fun,
        })
        .on('change', query)

      const id = '_design/' + fun.split('/')[0]
      ddocSubscription = pouch
        .changes({
          live: true,
          since: 'now',
          doc_ids: [id],
        })
        .on('change', change => {
          if (!isMounted) return

          if (change.deleted) {
            setState(EQueryState.error)
            setError(MISSING_DOC)
            setResult({
              rows: [],
              total_rows: 0,
              offset: 0,
            })
          } else {
            query()
          }
        })
    } else {
      let viewFunction: (
        doc: any,
        emit: (key: any, value?: any) => void
      ) => void

      if (typeof fun === 'function') {
        viewFunction = fun
      } else if (typeof fun === 'object' && typeof fun.map === 'function') {
        viewFunction = fun.map
      }

      subscription = pouch
        .changes({
          live: true,
          since: 'now',
          filter: doc => {
            let isDocInView: boolean = false

            viewFunction(doc, (_key: any, _value?: any) => {
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

      if (ddocSubscription) {
        ddocSubscription.cancel()
      }
    }
  }, [
    fun,
    reduce,
    include_docs,
    conflicts,
    attachments,
    binary,
    startkey,
    endkey,
    inclusive_end,
    limit,
    skip,
    descending,
    key,
    keys,
    group,
    group_level,
  ])

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

function optionToString(
  option: any | null | undefined
): string | number | boolean | undefined {
  if (option != null && typeof option === 'object') {
    // also arrays
    return '_usePouchDB_json_encoded:' + JSON.stringify(option)
  } else if (option) {
    return option
  } else {
    return undefined
  }
}
