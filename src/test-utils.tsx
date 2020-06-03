import React from 'react'
import {
  renderHook as testingLibraryRenderHook,
  RenderHookResult,
} from '@testing-library/react-hooks'

import { Provider } from './context'

export * from '@testing-library/react-hooks'

export interface Options<P> {
  initialProps?: P
  pouchdb: PouchDB.Database
}

export function renderHook<P, R>(
  callback: (props: P) => R,
  options?: Options<P>
): RenderHookResult<P, R> {
  const optionsObject =
    options != null
      ? {
          initialProps: options.initialProps,
          wrapper: function Wrapper({
            children,
          }: {
            children: React.ReactChildren
          }) {
            return <Provider pouchdb={options.pouchdb}>{children}</Provider>
          },
        }
      : undefined

  return testingLibraryRenderHook(callback, optionsObject)
}
