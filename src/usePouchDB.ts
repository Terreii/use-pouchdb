import { useContext } from 'react'

import { PouchContext } from './context'

/**
 * Get access to the PouchDB database that is provided by the provider.
 */
export default function usePouchDB() {
  return useContext(PouchContext)
}
