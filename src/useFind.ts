import { useEffect } from 'react'
import { matchesSelector } from 'pouchdb-selector-core'

import { useContext } from './context'
import type SubscriptionManager from './subscription'
import useStateMachine, { ResultType } from './state-machine'
import { useDeepMemo } from './utils'

/**
 * Set which index to use for the query. Or create one and use it. It can be:
 *
 * - "design-doc-name"
 * - ["design-doc-name", "name"]
 * - Object to create an index (the same options as db.createIndex).
 */
export type FindHookIndexOption =
  | string
  | [string, string]
  | {
      /**
       * List of fields to index
       */
      fields: string[]

      /**
       * Name of the index, auto-generated if you don't include it
       */
      name?: string

      /**
       * Design document name (i.e. the part after '_design/',
       * auto-generated if you don't include it.
       */
      ddoc?: string

      /**
       * Only supports 'json', and it's also the default
       */
      type?: string
    }

export interface FindHookOptions {
  /**
   * Set which index to use for the query. Or create one and use it. It can be:
   *
   * - "design-doc-name"
   * - ["design-doc-name", "name"]
   * - Object to create an index (the same options as db.createIndex).
   */
  index?: FindHookIndexOption

  /**
   * Defines a selector to filter the results. Required
   */
  selector: PouchDB.Find.Selector

  /**
   * Defines a list of fields that you want to receive. If omitted, you get the full documents.
   */
  fields?: string[]

  /**
   * Defines a list of fields defining how you want to sort.
   * Note that sorted fields also have to be selected in the selector.
   */
  sort?: Array<string | { [propName: string]: 'asc' | 'desc' }>

  /**
   * Maximum number of documents to return.
   */
  limit?: number

  /**
   * Number of docs to skip before returning.
   */
  skip?: number
}

/**
 * Query, and optionally create, a Mango index and subscribe to its updates.
 * @param {object} [opts] A combination of PouchDB's find options and create index options.
 */
export default function useFind<Content>(
  options: FindHookOptions
): ResultType<PouchDB.Find.FindResponse<Content>> {
  const { pouchdb: pouch, subscriptionManager } = useContext()

  if (
    typeof pouch?.createIndex !== 'function' ||
    typeof pouch?.find !== 'function'
  ) {
    throw new TypeError(
      'db.createIndex() or/and db.find() are not defined. Please install "pouchdb-find"'
    )
  }

  const index = useDeepMemo(options.index)
  const selector = useDeepMemo(options.selector)
  const fields = useDeepMemo(options.fields)
  const sort = useDeepMemo(options.sort)
  const limit = options.limit
  const skip = options.skip

  const [state, dispatch] = useStateMachine<PouchDB.Find.FindResponse<Content>>(
    () => ({
      docs: [],
    })
  )

  useEffect(() => {
    let isActive = true
    let isFetching = false
    let shouldUpdateAfter = false

    // if _id isn't in the fields array it will be added internally
    const didAddIdToFields =
      Array.isArray(fields) && fields.length > 0 && !fields.includes('_id')
    // internal fields-array. Ensure to always fetch _id
    const fieldsToFetch = didAddIdToFields ? fields?.concat(['_id']) : fields
    // Container for the ids in the result. It is in a object to be used as a ref.
    const idsInResult: { ids: Set<PouchDB.Core.DocumentId> } = {
      ids: new Set(),
    }
    let name: string | undefined = undefined
    let ddoc: string | undefined = undefined

    // Query a mango query and update the state.
    const query = async () => {
      if (isFetching) {
        shouldUpdateAfter = true
        return
      }
      isFetching = true

      dispatch({ type: 'loading_started' })

      try {
        let indexToUse: string | [string, string] | undefined = undefined
        if (ddoc && name) {
          indexToUse = [ddoc, name]
        } else if (ddoc) {
          indexToUse = ddoc
        }

        const result = (await pouch.find({
          selector,
          fields: fieldsToFetch,
          sort,
          limit,
          skip,
          use_index: indexToUse,
        })) as PouchDB.Find.FindResponse<Content>

        if (isActive) {
          idsInResult.ids = new Set()

          for (const doc of result.docs) {
            idsInResult.ids.add(doc._id)

            // if _id was added to the fields array, remove it,
            // so that the user only gets what they want.
            if (didAddIdToFields) {
              delete doc._id
            }
          }

          dispatch({ type: 'loading_finished', payload: result })
        }
      } catch (error) {
        if (isActive) {
          dispatch({
            type: 'loading_error',
            payload: { error, setResult: false },
          })
        }
      } finally {
        isFetching = false

        // Re-query if a change did happen while querying
        if (isActive && shouldUpdateAfter) {
          shouldUpdateAfter = false
          query()
        }
      }
    }

    let unsubscribe: (() => void) | undefined = undefined

    dispatch({ type: 'loading_started' })

    // Create an index or get the index that will be used.
    getIndex(pouch, index, { selector })
      .then(([ddocId, indexName]) => {
        if (!isActive) return

        if (ddocId) {
          ddoc = ddocId
        }
        name = indexName

        query()

        unsubscribe = subscribe(
          subscriptionManager,
          selector,
          query,
          ddocId,
          idsInResult
        )
      })
      .catch(error => {
        if (isActive) {
          dispatch({
            type: 'loading_error',
            payload: { error, setResult: false },
          })
          query()

          unsubscribe = subscribe(
            subscriptionManager,
            selector,
            query,
            null,
            idsInResult
          )
        }
      })

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [
    pouch,
    subscriptionManager,
    dispatch,
    index,
    selector,
    fields,
    sort,
    limit,
    skip,
  ])

  return state
}

/**
 * Get the ddoc & name of an index. Create it if the index doesn't exist.
 * @param db        - The PouchDB database.
 * @param index     - Name or Create Index options.
 * @param selector  - The selector used.
 */
function getIndex(
  db: PouchDB.Database,
  index: FindHookIndexOption | undefined,
  selector: PouchDB.Find.FindRequest<Record<string, unknown>>
): Promise<[string | null, string]> {
  if (index && typeof index === 'string') {
    return findIndex(db, selector)
  } else if (index && Array.isArray(index)) {
    return Promise.resolve(index)
  } else if (index && typeof index === 'object') {
    return createIndex(db, { index })
  } else {
    return findIndex(db, selector)
  }
}

/**
 * Create an index. Returns the ddoc & name.
 * @param db - The PouchDB database.
 * @param index - Options for db.createIndex
 */
async function createIndex(
  db: PouchDB.Database,
  index: PouchDB.Find.CreateIndexOptions
): Promise<[string, string]> {
  const result = (await db.createIndex(
    index
  )) as PouchDB.Find.CreateIndexResponse<Record<string, unknown>> & {
    id: PouchDB.Core.DocumentId
    name: string
  }
  return [result.id, result.name]
}

/**
 * Find a index for the given selector. Returns ddoc & name.
 * @param db - The PouchDB database.
 * @param selector - The selector used.
 */
async function findIndex(
  db: PouchDB.Database,
  selector: PouchDB.Find.FindRequest<Record<string, unknown>>
): Promise<[string | null, string]> {
  const database = db as PouchDB.Database & {
    explain: (selector: PouchDB.Find.Selector) => Promise<ExplainResult>
  }
  const result = await database.explain(selector)
  return [result.index.ddoc, result.index.name]
}

/**
 * Subscribes to updates in the database and re-query
 * when a document did change that matches the selector.
 * @param subscriptionManager - The current subscription manager.
 * @param selector - Selector, to filter out changes.
 * @param query - Function to run a query.
 * @param id - Id of the ddoc where the index is stored.
 */
function subscribe(
  subscriptionManager: SubscriptionManager,
  selector: PouchDB.Find.Selector,
  query: () => void,
  id: PouchDB.Core.DocumentId | null,
  idsInResult: { ids: Set<PouchDB.Core.DocumentId> }
): () => void {
  const ddocName = id
    ? '_design/' + id.replace(/^_design\//, '') // normalize, user can add a ddoc name
    : undefined

  return subscriptionManager.subscribeToDocs<Record<string, unknown>>(
    null,
    (deleted, id, doc) => {
      if (deleted && idsInResult.ids.has(id)) {
        query()
      } else if (id === ddocName) {
        query()
      } else if (doc && typeof matchesSelector !== 'function') {
        // because pouchdb-selector-core is semver-free zone
        // If matchesSelector doesn't exist, just query every time
        query()
      } else if (doc && matchesSelector(doc, selector)) {
        query()
      }
    }
  )
}

interface ExplainResult {
  dbname: string
  index: PouchDB.Find.Index & { defaultUsed?: true }
  selector: PouchDB.Find.Selector
  opts: {
    use_index: string[]
    bookmark: string
    limit: number | undefined
    skip: number | undefined
    sort: { [propName: string]: 'asc' | 'desc' }
    fields: string[] | undefined
    r: number[]
    conflicts: boolean
  }
  limit: number | undefined
  skip: number
  fields: string[] | undefined
  range: {
    start_key: unknown[] | null
    end_key: unknown[] | undefined
  }
}
