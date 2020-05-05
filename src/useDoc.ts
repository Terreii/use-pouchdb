import { useState, useEffect, useRef, useMemo } from 'react'

import { useContext } from './context'

/**
 * Retrieves a document and subscribes to it's changes.
 * @param {string} id - Document ID of the document that should be fetched.
 * @param {object} [options] - PouchDB get options. Excluding 'open_revs'.
 * @param {object|function} [initialValue] - Value that should be returned while fetching the doc.
 */
export default function useDoc<Content extends {}>(
  id: PouchDB.Core.DocumentId,
  options?: PouchDB.Core.GetOptions,
  initialValue?: (() => Content) | Content
) {
  type Document = (PouchDB.Core.Document<Content> & PouchDB.Core.GetMeta) | null

  const { pouchdb: pouch, subscriptionManager } = useContext()

  const { rev, revs, revs_info, conflicts, attachments, binary, latest } =
    options || {}

  const [doc, setDoc] = useState<Content | Document | null>(initialValue!)
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [error, setError] = useState<PouchDB.Core.Error | null>(null)

  // Reset the document to initialValue (or null)
  const setToInitialValue = (fallBackToNull: boolean) => {
    if (initialValue && typeof initialValue === 'object') {
      setDoc(initialValue)
    } else if (typeof initialValue === 'function') {
      setDoc((initialValue as Function)())
    } else if (fallBackToNull) {
      setDoc(null)
    }
  }

  // Reset the document if the id did change and a initial value is set.
  const lastId = useRef(id)
  useEffect(() => {
    if (id === lastId.current) return
    lastId.current = id

    setToInitialValue(false)
  }, [id, initialValue])

  useEffect(() => {
    // Is this instance still current?
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

    // Use the changes feed to get updates to the document
    const unsubscribe =
      rev && !latest // but don't subscribe if a specific rev is requested.
        ? () => {}
        : subscriptionManager.subscribeToDocs([id], (deleted, _id, doc) => {
            if (!isMounted) return

            // If the document got deleted it should change to an 404 error state
            // or if there is a conflicting version, then it should show the new winning one.
            if (deleted || revs || revs_info || conflicts || attachments) {
              fetchDoc()
            } else {
              setDoc(
                doc as PouchDB.Core.Document<Content> & PouchDB.Core.GetMeta
              )
              setState('done')
              setError(null)
            }
          })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [pouch, id, rev, revs, revs_info, conflicts, attachments, binary, latest])

  return useMemo(() => {
    const resultDoc = doc as Document

    // Add _id and _rev to the initial value (if they aren't set)
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
