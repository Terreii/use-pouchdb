import { useEffect } from 'react'

import { useContext } from './context'
import useStateMachine, { ResultType } from './state-machine'

/**
 * Get all docs or a slice of all docs and subscribe to their updates.
 * @param options PouchDB's allDocs options.
 */
export default function useAllDocs<Content>(
  options?:
    | PouchDB.Core.AllDocsWithKeyOptions
    | PouchDB.Core.AllDocsWithKeysOptions
    | PouchDB.Core.AllDocsWithinRangeOptions
    | PouchDB.Core.AllDocsOptions
): ResultType<PouchDB.Core.AllDocsResponse<Content>> {
  const { pouchdb: pouch, subscriptionManager } = useContext()

  const {
    include_docs,
    conflicts,
    attachments,
    binary,
    limit,
    skip,
    descending,
    update_seq,
  } = options || {}
  const { startkey, endkey, inclusive_end } =
    (options as PouchDB.Core.AllDocsWithinRangeOptions) || {}
  const { key } = (options as PouchDB.Core.AllDocsWithKeyOptions) || {}
  const { keys } = (options as PouchDB.Core.AllDocsWithKeysOptions) || {}

  const [state, dispatch, replace] = useStateMachine<
    PouchDB.Core.AllDocsResponse<Content>
  >(() => ({
    rows: [],
    total_rows: 0,
    offset: 0,
  }))

  useEffect(() => {
    let isMounted = true
    let isFetching = false
    let shouldUpdateAfter = false

    const opt = {
      include_docs,
      conflicts,
      attachments,
      binary,
      limit,
      skip,
      descending,
      update_seq,
      startkey,
      endkey,
      inclusive_end,
      key,
      keys,
    }

    const fetch = async () => {
      if (isFetching) {
        shouldUpdateAfter = true
        return
      }
      isFetching = true
      shouldUpdateAfter = false
      dispatch({ type: 'loading_started' })

      try {
        const result = await pouch.allDocs<Content>(opt)

        if (isMounted) {
          dispatch({
            type: 'loading_finished',
            payload: result,
          })
        }
      } catch (err) {
        if (isMounted) {
          dispatch({
            type: 'loading_error',
            payload: {
              error: err,
              setResult: false,
            },
          })
        }
      } finally {
        // refresh if change did happen while querying
        isFetching = false
        if (shouldUpdateAfter && isMounted) {
          fetch()
        }
      }
    }

    fetch()

    let keysToSubscribe: null | string[] = null

    if (key != null) {
      keysToSubscribe = [key]
    } else if (keys != null) {
      keysToSubscribe = keys
    }

    const unsubscribe = subscriptionManager.subscribeToDocs(
      keysToSubscribe,
      (deleted, id) => {
        if (
          !isMounted ||
          !isInRange(id, startkey, endkey, inclusive_end, descending)
        ) {
          return
        }

        if (deleted) {
          replace(result => {
            const rows = result.rows.filter(row => row.id !== id)
            return {
              ...result,
              rows,
              total_rows:
                result.total_rows - (result.rows.length - rows.length),
            }
          })
        } else {
          fetch()
        }
      }
    )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [
    dispatch,
    replace,
    pouch,
    subscriptionManager,
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
    update_seq,
  ])

  return state
}

/**
 * Check if the updated document is inside of the range.
 * @param id Id of the updated document
 * @param startkey Startkey option.
 * @param endkey Endkey option.
 * @param inclusive_end Is the endkey inclusive?
 * @param descending Which direction should the slice go?
 */
function isInRange(
  id: PouchDB.Core.DocumentId,
  startkey: string | undefined,
  endkey: string | undefined,
  inclusive_end: boolean | undefined,
  descending: boolean | undefined
): boolean {
  if (
    startkey &&
    ((descending && id > startkey) || (!descending && id < startkey))
  ) {
    return false
  }
  if (endkey == null) {
    return true
  }
  if (inclusive_end) {
    return descending ? id >= endkey : id <= endkey
  } else {
    return descending ? id > endkey : id < endkey
  }
}
