import { useEffect, useRef } from 'react'

import { useContext } from './context'
import useStateMachine, { ResultType } from './state-machine'

type DocResultType<T> = ResultType<{
  doc: (PouchDB.Core.Document<T> & PouchDB.Core.GetMeta) | null
}>

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
): DocResultType<Content> {
  type Document = (PouchDB.Core.Document<Content> & PouchDB.Core.GetMeta) | null

  const { pouchdb: pouch, subscriptionManager } = useContext()

  const { rev, revs, revs_info, conflicts, attachments, binary, latest } =
    options || {}

  const getInitialValue = (): { doc: Document } => {
    let doc: Content | null = null

    if (typeof initialValue === 'function') {
      doc = (initialValue as Function)()
    } else if (initialValue && typeof initialValue === 'object') {
      doc = initialValue
    }

    const resultDoc = doc as Document

    // Add _id and _rev to the initial value (if they aren't set)
    if (resultDoc && resultDoc._id == null) {
      resultDoc._id = id
    }
    if (resultDoc && resultDoc._rev == null) {
      resultDoc._rev = ''
    }

    return { doc: resultDoc }
  }

  const [state, dispatch] = useStateMachine(getInitialValue)

  // Reset the document if the id did change and a initial value is set.
  const lastId = useRef(id)
  useEffect(() => {
    if (id === lastId.current) return
    lastId.current = id

    if (initialValue != null) {
      dispatch({
        type: 'loading_finished',
        payload: getInitialValue(),
      })
    }
  }, [id, initialValue])

  useEffect(() => {
    // Is this instance still current?
    let isMounted = true

    const fetchDoc = async () => {
      dispatch({ type: 'loading_started' })

      try {
        const doc = await pouch.get<Document>(id, {
          rev,
          revs,
          revs_info,
          conflicts,
          attachments,
          binary,
          latest,
        })!

        if (isMounted) {
          dispatch({
            type: 'loading_finished',
            payload: { doc },
          })
        }
      } catch (err) {
        if (isMounted) {
          dispatch({
            type: 'loading_error',
            payload: {
              error: err,
              setResult: true,
              result: getInitialValue(),
            },
          })
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
              dispatch({
                type: 'loading_finished',
                payload: {
                  doc: doc as PouchDB.Core.Document<Content> &
                    PouchDB.Core.GetMeta,
                },
              })
            }
          })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [pouch, id, rev, revs, revs_info, conflicts, attachments, binary, latest])

  return state
}
