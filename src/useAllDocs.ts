import { useState, useEffect, useMemo } from 'react'

import { useContext } from './context'

type QueryState = 'loading' | 'done' | 'error'

export default function useAllDocs<Content extends {}, Model = Content>(
  options?:
    | PouchDB.Core.AllDocsWithKeyOptions
    | PouchDB.Core.AllDocsWithKeysOptions
    | PouchDB.Core.AllDocsWithinRangeOptions
    | PouchDB.Core.AllDocsOptions
): PouchDB.Core.AllDocsResponse<Content & Model> & {
  loading: boolean
  state: 'loading' | 'done' | 'error'
  error: PouchDB.Core.Error | null
} {
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

  const [result, setResult] = useState<
    PouchDB.Core.AllDocsResponse<Content & Model>
  >(() => ({
    rows: [],
    total_rows: 0,
    offset: 0,
  }))
  const [state, setState] = useState<QueryState>('loading')
  const [error, setError] = useState<PouchDB.Core.Error | null>(null)

  useEffect(() => {
    let isMounted = true
    let isFetching = false
    let shouldUpdateAfter = false

    const fetch = async () => {
      if (isFetching) {
        shouldUpdateAfter = true
        return
      }
      isFetching = true
      shouldUpdateAfter = false
      setState('loading')

      try {
        const result = await pouch.allDocs<Content & Model>(options || {})

        if (isMounted) {
          setState('done')
          setError(null)
          setResult(result)
        }
      } catch (err) {
        if (isMounted) {
          setState('error')
          setError(err)
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
        if (!isMounted) return

        let isInRange = true
        const rangeOptions = options as
          | PouchDB.Core.AllDocsWithinRangeOptions
          | undefined

        if (rangeOptions?.startkey) {
          isInRange = options?.descending
            ? id < rangeOptions.startkey
            : id > rangeOptions.startkey
        }
        if (isInRange && !rangeOptions?.inclusive_end && rangeOptions?.endkey) {
          isInRange = options?.descending
            ? id > rangeOptions.endkey
            : id < rangeOptions.endkey
        } else if (
          isInRange &&
          rangeOptions?.inclusive_end &&
          rangeOptions?.endkey
        ) {
          isInRange = options?.descending
            ? id >= rangeOptions.endkey
            : id <= rangeOptions.endkey
        }

        if (!isInRange) return

        if (deleted) {
          setResult(result => {
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
    pouch,
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

  return useMemo(
    () => ({
      ...result,
      state,
      error,
      loading: state === 'loading',
    }),
    [result, state, error]
  )
}
