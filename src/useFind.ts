import { ResultType } from './state-machine'

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
       * Design document name (i.e. the part after '_design/', auto-generated if you don't include it
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

export default function useFind<Content>(
  _opt: FindHookOptions
): ResultType<PouchDB.Find.FindResponse<Content>> {
  return {
    docs: [],
    loading: false,
    state: 'loading',
    error: null,
  }
}
