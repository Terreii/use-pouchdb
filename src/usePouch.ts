import { useContext } from './context'

/**
 * Get access to the PouchDB database that is provided by the provider.
 */
export default function usePouch() {
  return useContext().pouchdb
}
