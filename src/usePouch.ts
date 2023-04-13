import { useContext } from './context'

/**
 * Get access to the PouchDB database that is provided by the provider.
 * @param {string | undefined} dbName Select the database to be returned by its name/key.
 */
export default function usePouch<T extends Record<string, unknown>>(
  dbName?: string
): PouchDB.Database<T> {
  return useContext(dbName).pouchdb as PouchDB.Database<T>
}
