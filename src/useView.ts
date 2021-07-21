import { useEffect, useRef } from 'react'
import { MISSING_DOC } from 'pouchdb-errors'

import { useContext } from './context'
import type SubscriptionManager from './subscription'
import useStateMachine, { ResultType, Dispatch } from './state-machine'
import { useDeepMemo, CommonOptions } from './utils'

type ViewResponseBase<Result> = PouchDB.Query.Response<Result> & {
  /**
   * Include an update_seq value indicating which sequence id of the underlying database the view
   * reflects.
   */
  update_seq?: number | string
}

export type ViewResponse<T> = ResultType<ViewResponseBase<T>>

/**
 * Query a view and subscribe to its updates.
 * @param {string | function | object} fun The name of the view or a temporary view.
 * @param {object} [opts] PouchDB's query-options
 */
export default function useView<Content, Result, Model = Content>(
  fun: string | PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
  opts?: PouchDB.Query.Options<Model, Result> & {
    update_seq?: boolean
  } & CommonOptions
): ViewResponse<Result> {
  const { pouchdb: pouch, subscriptionManager } = useContext(opts?.db)

  if (typeof pouch?.query !== 'function') {
    throw new TypeError(
      'db.query() is not defined. Please install "pouchdb-mapreduce"'
    )
  }

  const lastView = useRef<string | null>(null)

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
    stale,
  } = opts || {}

  const startkey = useDeepMemo(opts?.startkey)
  const endkey = useDeepMemo(opts?.endkey)
  const key = useDeepMemo(opts?.key)
  const keys = useDeepMemo(opts?.keys)

  const [state, dispatch] = useStateMachine<ViewResponseBase<Result>>(() => ({
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
      startkey,
      endkey,
      key,
      keys,
      // only add the stale option if the view is not the same as last request.
      // Because the view is already upto date.
      stale: lastView.current === fun ? undefined : stale,
    }

    if (typeof fun === 'string') {
      lastView.current = fun
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
    dispatch,
    pouch,
    subscriptionManager,
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
    stale,
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
  pouch: PouchDB.Database<Record<string, unknown>>,
  subscriptionManager: SubscriptionManager,
  fn: string,
  option?: PouchDB.Query.Options<Model, Result>
): () => void {
  let isMounted = true
  let isFetching = false // A query is underway.
  let shouldUpdateAfter = false // A relevant update did happen while fetching.
  let isReduce = Boolean(option?.reduce)

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
      // when reduce listen to all doc changes. Because reduce doesn't have ids in the result.
      isReduce ? null : ids,
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
      // Reduce doesn't return ids. Only keys and values.
      // Checked because the reduce option defaults to true.
      const isThisReduced = ids.size === 0 && result.rows.length > 0

      if (!isReduce || isReduce !== isThisReduced) {
        isReduce = isThisReduced
        ids.add(id)
        createDocSubscription(Array.from(ids))
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
      if (isMounted) {
        // refresh if change did happen while querying
        isFetching = false
        if (option?.stale) {
          // future queries shouldn't be stale
          delete option.stale
          query()
        } else if (shouldUpdateAfter) {
          query()
        }
      }
    }
  }

  query()
  createDocSubscription([id])

  // Subscribe to new entries in the view.
  const unsubscribe = subscriptionManager.subscribeToView(fn, id => {
    if (isMounted && !isReduce && !lastResultIds.has(id)) {
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
  pouch: PouchDB.Database<Record<string, unknown>>,
  subscriptionManager: SubscriptionManager,
  fn: PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
  option?: PouchDB.Query.Options<Model, Result>
): () => void {
  let isMounted = true
  let isFetching = false // A query is underway.
  let shouldUpdateAfter = false // A relevant update did happen while fetching.
  const isReduce =
    typeof option?.reduce === 'string' ||
    (option?.reduce !== false && typeof fn === 'object' && Boolean(fn.reduce))
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

  let viewFunction: PouchDB.Map<Model, Result>

  if (typeof fn === 'function') {
    viewFunction = fn
  } else if (typeof fn === 'object' && typeof fn.map === 'function') {
    viewFunction = fn.map
  }

  // Subscribe to updates of the view.
  const unsubscribe = subscriptionManager.subscribeToDocs<Model>(
    null,
    (_deleted, id, doc) => {
      if (isReduce) {
        query()
        return
      }
      try {
        let isDocInView = false
        if (doc) {
          viewFunction(doc, () => {
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
