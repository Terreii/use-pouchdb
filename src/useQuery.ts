import { useState, useEffect, useMemo } from 'react'
import { MISSING_DOC } from 'pouchdb-errors'

import usePouch from './usePouch'

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
  const [state, setState] = useState<QueryState>('loading')
  const [error, setError] = useState<PouchDB.Core.Error | null>(null)

  useEffect(() => {
    if (typeof fun === 'string') {
      return doDDocQuery(setResult, setState, setError, pouch, fun, opts)
    } else {
      return doTemporaryQuery(setResult, setState, setError, pouch, fun, opts)
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
      state,
      error,
      loading: state === 'loading',
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

function doDDocQuery<Model, Result>(
  setResult: (r: PouchDB.Query.Response<Result>) => void,
  setState: (state: QueryState) => void,
  setError: (error: PouchDB.Core.Error | null) => void,
  pouch: PouchDB.Database<{}>,
  fn: string,
  option?: PouchDB.Query.Options<Model, Result>
): () => void {
  let isMounted = true
  let isFetching = false
  let shouldUpdateAfter = false

  let lastUpdateSeq: string | number = 'now'
  let subscription: PouchDB.Core.Changes<any>
  let ddocSubscription: PouchDB.Core.Changes<any> | null = null

  let lastResultIds = new Set<PouchDB.Core.DocumentId>()
  const id = '_design/' + fn.split('/')[0]

  const createDocSubscription = (ids: string[]) => {
    if (ddocSubscription != null) {
      ddocSubscription.cancel()
    }

    ddocSubscription = pouch
      .changes({
        live: true,
        since: lastUpdateSeq,
        doc_ids: ids,
      })
      .on('change', change => {
        if (!isMounted) return

        lastUpdateSeq = change.seq

        if (change.id === id && change.deleted) {
          setState('error')
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
  }

  const query = async () => {
    if (isFetching) {
      shouldUpdateAfter = true
      return
    }
    isFetching = true
    shouldUpdateAfter = false
    setState('loading')

    try {
      const result = await pouch.query(fn, option)
      if (!isMounted) return

      setState('done')
      setError(null)
      setResult(result)

      const ids = new Set<PouchDB.Core.DocumentId>()
      for (const row of result.rows) {
        if (row.id != null) {
          ids.add(row.id)
        }
      }
      lastResultIds = ids

      if (ids.size === 0) {
        createDocSubscription([id])
      } else {
        ids.add(id)
        createDocSubscription(Array.from(ids))
      }
    } catch (error) {
      if (isMounted) {
        setState('error')
        setError(error)
      }
    } finally {
      // refresh if change did happen while querying
      isFetching = false
      if (shouldUpdateAfter && isMounted) {
        query()
      }
    }
  }

  query()
  createDocSubscription([id])

  subscription = pouch
    .changes({
      live: true,
      since: 'now',
      filter: '_view',
      view: fn,
    })
    .on('change', change => {
      if (!lastResultIds.has(change.id)) {
        query()
      }
    })

  return () => {
    isMounted = false
    subscription.cancel()

    if (ddocSubscription) {
      ddocSubscription.cancel()
    }
  }
}

function doTemporaryQuery<Model, Result>(
  setResult: (r: PouchDB.Query.Response<Result>) => void,
  setState: (state: QueryState) => void,
  setError: (error: PouchDB.Core.Error | null) => void,
  pouch: PouchDB.Database<{}>,
  fn: PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
  option?: PouchDB.Query.Options<Model, Result>
): () => void {
  let isMounted = true
  let isFetching = false
  let shouldUpdateAfter = false
  let resultIds: Set<PouchDB.Core.DocumentId | null> | null = null

  const query = async () => {
    if (isFetching) {
      shouldUpdateAfter = true
      return
    }
    isFetching = true
    shouldUpdateAfter = false
    setState('loading')

    try {
      const result = await pouch.query(fn, option)
      if (!isMounted) return

      setState('done')
      setError(null)
      setResult(result)

      const ids = new Set<PouchDB.Core.DocumentId | null>()
      for (const row of result.rows) {
        if (row.id != null) {
          ids.add(row.id)
        }
      }
      if (ids.size === 0) {
        resultIds = null
      } else {
        resultIds = ids
      }
    } catch (error) {
      if (isMounted) {
        setState('error')
        setError(error)
      }
    } finally {
      // refresh if change did happen while querying
      isFetching = false
      if (shouldUpdateAfter && isMounted) {
        query()
      }
    }
  }

  query()

  let subscription: PouchDB.Core.Changes<any>

  let viewFunction: (doc: any, emit: (key: any, value?: any) => void) => void

  if (typeof fn === 'function') {
    viewFunction = fn
  } else if (typeof fn === 'object' && typeof fn.map === 'function') {
    viewFunction = fn.map
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

        return isDocInView || resultIds?.has(doc._id)
      },
    })
    .on('change', query)

  return () => {
    isMounted = false
    subscription.cancel()
  }
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
