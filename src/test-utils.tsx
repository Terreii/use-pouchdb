import React from 'react'
import { renderHook as testingLibraryRenderHook } from '@testing-library/react-hooks'

import { Provider } from './context'

export * from '@testing-library/react-hooks'

export interface Options<P> {
  initialProps?: P
  pouchdb: PouchDB.Database
}

export function renderHook<P, R>(
  callback: (props: P) => R,
  options?: Options<P>
) {
  const optionsObject =
    options != null
      ? {
          initialProps: options.initialProps,
          wrapper: ({ children }) => (
            <Provider pouchdb={options.pouchdb}>{children}</Provider>
          ),
        }
      : undefined

  return testingLibraryRenderHook(callback, optionsObject)
}
