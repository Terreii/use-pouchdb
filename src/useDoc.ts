import { useState, useEffect, useRef, useMemo } from 'react'
import { MISSING_DOC } from 'pouchdb-errors'

import usePouchDB from './usePouch'

export default function useDoc<Content extends {}>(
  id: PouchDB.Core.DocumentId,
  options?: PouchDB.Core.GetOptions,
  initialValue?: (() => Content) | Content
) {
  const pouch = usePouchDB()

  const { rev, revs, revs_info, conflicts, attachments, binary, latest } =
    options || {}

  const [doc, setDoc] = useState<
    Content | (PouchDB.Core.Document<Content> & PouchDB.Core.GetMeta) | null
  >(initialValue!)
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [error, setError] = useState<PouchDB.Core.Error | null>(null)

  const setToInitialValue = (fallBackToNull: boolean) => {
    if (initialValue && typeof initialValue === 'object') {
      setDoc(initialValue)
    } else if (typeof initialValue === 'function') {
      setDoc((initialValue as Function)())
    } else if (fallBackToNull) {
      setDoc(null)
    }
  }

  const lastId = useRef(id)
  useEffect(() => {
    if (id === lastId.current) return
    lastId.current = id

    setToInitialValue(false)
  }, [id, initialValue])

  useEffect(() => {
    let isMounted = true

    const fetchDoc = async () => {
      setState('loading')

      try {
        const doc = await pouch.get<Content>(id, {
          rev,
          revs,
          revs_info,
          conflicts,
          attachments,
          binary,
          latest,
        })!

        if (isMounted) {
          setState('done')
          setDoc(doc)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setState('error')
          setError(err)
          setToInitialValue(true)
        }
      }
    }

    fetchDoc()

    const subscription = pouch
      .changes({
        live: true,
        since: 'now',
        doc_ids: [id],
        include_docs: true,
        conflicts,
        attachments,
        binary,
      })
      .on('change', change => {
        if (!isMounted) return

        if (change.deleted) {
          setToInitialValue(true)
          setError(MISSING_DOC)
          setState('error')
        } else {
          setDoc(
            change.doc as PouchDB.Core.Document<Content> & PouchDB.Core.GetMeta
          )
          setState('done')
          setError(null)
        }
      })

    return () => {
      isMounted = false
      subscription.cancel()
    }
  }, [id, rev, revs, revs_info, conflicts, attachments, binary, latest])

  return useMemo(() => {
    const resultDoc = doc as PouchDB.Core.Document<Content> &
      PouchDB.Core.GetMeta
    if (resultDoc && resultDoc._id == null) {
      resultDoc._id = id
    }
    if (resultDoc && resultDoc._rev == null) {
      resultDoc._rev = ''
    }
    return {
      doc: resultDoc,
      state,
      error,
    }
  }, [id, doc, state, error])
}
