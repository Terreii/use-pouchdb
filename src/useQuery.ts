import { useState, useEffect, useMemo } from 'react'
import { MISSING_DOC } from 'pouchdb-errors'

import { useContext } from './context'

export type QueryState = 'loading' | 'done' | 'error'

export interface QueryResponse<Result> extends PouchDB.Query.Response<Result> {
  /**
   * Include an update_seq value indicating which sequence id of the underlying database the view
   * reflects.
   */
  update_seq?: number | string
  /**
   * Query state. Can be 'loading', 'done' or 'error'.
   */
  state: QueryState
  /**
   * If the query did error it is returned in this field.
   */
  error: PouchDB.Core.Error | null
  /**
   * Is this hook currently loading/updating the query.
   */
  loading: boolean
}

/**
 * Query a view and subscribe to its updates.
 * @param {string | function | object} fun The name of the view or a temporary view.
 * @param {object} [opts] PouchDB's query-options
 */
export default function useQuery<Content extends {}, Result, Model = Content>(
  fun: string | PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
  opts?: PouchDB.Query.Options<Model, Result> & { update_seq?: boolean }
): QueryResponse<Result> {
  const { pouchdb: pouch } = useContext()

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
    update_seq,
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
    const options = {
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
      update_seq,
      startkey: opts?.startkey,
      endkey: opts?.endkey,
      key: opts?.key,
      keys: opts?.keys,
      // stale is not yet supported
      // stale: stale,
    }

    if (typeof fun === 'string') {
      return doDDocQuery(setResult, setState, setError, pouch, fun, options)
    } else {
      return doTemporaryQuery(
        setResult,
        setState,
        setError,
        pouch,
        fun,
        options
      )
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
    update_seq,
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

/**
 * Query and subscribe to updates of a view in a ddoc.
 * @param setResult setState for the result.
 * @param setState setState for state.
 * @param setError setState to set the error.
 * @param pouch The pouch db.
 * @param fn Name of the view.
 * @param option PouchDB's query options.
 */
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

  // Subscribe to updates of documents that where returned in the last query,
  // and the design doc.
  // It subscribes to the result docs, to be notified of deletions and other updates of docs
  // which removes them from the view.
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

  // Does the query.
  // It updates the state only if this function is still active.
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

  // Subscribe to new entries in the view.
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

/**
 * Query and subscribe to updates of a temporary view (function or object with map function).
 * @param setResult setState for the result.
 * @param setState setState for state.
 * @param setError setState to set the error.
 * @param pouch The pouch db.
 * @param fn The temporary view.
 * @param option PouchDB's query options.
 */
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

  // Does the query.
  // It updates the state only if this function is still active.
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

  // Subscribe to updates of the view.
  subscription = pouch
    .changes({
      live: true,
      since: 'now',
      filter: doc => {
        let isDocInView: boolean = false

        viewFunction(doc, (_key: any, _value?: any) => {
          isDocInView = true
        })

        // Also check if one of the result documents did update in a way,
        // that removes it from the view.
        return isDocInView || resultIds?.has(doc._id)
      },
    })
    .on('change', query)

  return () => {
    isMounted = false
    subscription.cancel()
  }
}

/**
 * Parses a option that can be a JSON data structure.
 * It is then transformed into a comparable data type (null, number, or string).
 * For example key: It can be any valid JSON type.
 * @param option A option that can be a JSON data structure.
 */
function optionToString(
  option: any | null | undefined
): string | number | boolean | undefined {
  if (option != null && typeof option === 'object') {
    // also arrays
    return '_usePouchDB_json_encoded:' + JSON.stringify(option)
  } else if (option || option === null) {
    return option
  } else {
    return undefined
  }
}
