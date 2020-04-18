import { useContext } from 'react'

import { PouchContext } from './context'

/**
 * Get access to the PouchDB database that is provided by the provider.
 */
export default function usePouch() {
  const pouch = useContext(PouchContext)

  if (process.env.NODE_ENV !== 'production' && !pouch) {
    throw new Error(
      'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
    )
  }

  return pouch!
}
