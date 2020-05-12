import { useEffect } from 'react'
import { MISSING_DOC } from 'pouchdb-errors'

import { useContext } from './context'
import type SubscriptionManager from './subscription'
import useStateMachine, { ResultType, Dispatch } from './state-machine'

type QueryResponseBase<Result> = PouchDB.Query.Response<Result> & {
  /**
   * Include an update_seq value indicating which sequence id of the underlying database the view
   * reflects.
   */
  update_seq?: number | string
}

export type QueryResponse<T> = ResultType<QueryResponseBase<T>>

/**
 * Query a view and subscribe to its updates.
 * @param {string | function | object} fun The name of the view or a temporary view.
 * @param {object} [opts] PouchDB's query-options
 */
export default function useQuery<Content extends {}, Result, Model = Content>(
  fun: string | PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
  opts?: PouchDB.Query.Options<Model, Result> & { update_seq?: boolean }
): QueryResponse<Result> {
  const { pouchdb: pouch, subscriptionManager } = useContext()

  if (typeof pouch?.query !== 'function') {
    throw new TypeError(
      'db.query() is not defined. Please install "pouchdb-mapreduce"'
    )
  }

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

  const [state, dispatch] = useStateMachine<QueryResponseBase<Result>>(() => ({
    rows: [],
    total_rows: 0,
    offset: 0,
  }))

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
      return doDDocQuery(dispatch, pouch, subscriptionManager, fun, options)
    } else {
      return doTemporaryQuery(
        dispatch,
        pouch,
        subscriptionManager,
        fun,
        options
      )
    }
  }, [
    pouch,
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

  return state
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
  dispatch: Dispatch<PouchDB.Query.Response<Result>>,
  pouch: PouchDB.Database<{}>,
  subscriptionManager: SubscriptionManager,
  fn: string,
  option?: PouchDB.Query.Options<Model, Result>
): () => void {
  let isMounted = true
  let isFetching = false
  let shouldUpdateAfter = false

  let unsubscribeFromDocs: (() => void) | null = null

  let lastResultIds = new Set<PouchDB.Core.DocumentId>()
  const id = '_design/' + fn.split('/')[0]

  // Subscribe to updates of documents that where returned in the last query,
  // and the design doc.
  // It subscribes to the result docs, to be notified of deletions and other updates of docs
  // which removes them from the view.
  const createDocSubscription = (ids: string[]) => {
    if (unsubscribeFromDocs != null) {
      unsubscribeFromDocs()
    }

    unsubscribeFromDocs = subscriptionManager.subscribeToDocs(
      ids,
      (deleted, docId) => {
        if (!isMounted) return

        if (docId === id && deleted) {
          dispatch({
            type: 'loading_error',
            payload: {
              error: MISSING_DOC,
              setResult: true,
              result: {
                rows: [],
                total_rows: 0,
                offset: 0,
              },
            },
          })
        } else {
          query()
        }
      }
    )
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
    dispatch({ type: 'loading_started' })

    try {
      const result = await pouch.query(fn, option)
      if (!isMounted) return

      dispatch({
        type: 'loading_finished',
        payload: result,
      })

      const ids = new Set<PouchDB.Core.DocumentId>()
      for (const row of result.rows) {
        if (row.id != null) {
          ids.add(row.id)
        }
      }
      lastResultIds = ids

      ids.add(id)
      createDocSubscription(Array.from(ids))
    } catch (error) {
      if (isMounted) {
        dispatch({
          type: 'loading_error',
          payload: {
            error: error,
            setResult: false,
          },
        })
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
  const unsubscribe = subscriptionManager.subscribeToView(fn, id => {
    if (isMounted && !lastResultIds.has(id)) {
      query()
    }
  })

  return () => {
    isMounted = false
    unsubscribe()

    if (unsubscribeFromDocs) {
      unsubscribeFromDocs()
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
  dispatch: Dispatch<PouchDB.Query.Response<Result>>,
  pouch: PouchDB.Database<{}>,
  subscriptionManager: SubscriptionManager,
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
    dispatch({ type: 'loading_started' })

    try {
      const result = await pouch.query(fn, option)
      if (!isMounted) return

      dispatch({
        type: 'loading_finished',
        payload: result,
      })

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
        dispatch({
          type: 'loading_error',
          payload: {
            error,
            setResult: false,
          },
        })
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

  let viewFunction: (doc: any, emit: (key: any, value?: any) => void) => void

  if (typeof fn === 'function') {
    viewFunction = fn
  } else if (typeof fn === 'object' && typeof fn.map === 'function') {
    viewFunction = fn.map
  }

  // Subscribe to updates of the view.
  const unsubscribe = subscriptionManager.subscribeToDocs(
    null,
    (_deleted, id, doc) => {
      let isDocInView: boolean = false

      try {
        if (doc) {
          viewFunction(doc, (_key: any, _value?: any) => {
            isDocInView = true
          })
        }

        // Also check if one of the result documents did update in a way,
        // that removes it from the view.
        if (isDocInView || resultIds?.has(id)) {
          query()
        }
      } catch (err) {
        console.error(err)
      }
    }
  )

  return () => {
    isMounted = false
    unsubscribe()
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
