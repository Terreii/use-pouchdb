import React from 'react'
import {
  renderHook as testingLibraryRenderHook,
  RenderHookResult,
  RenderHookOptions,
} from '@testing-library/react-hooks'

import { Provider } from './context'

export * from '@testing-library/react-hooks'

export type DocWithAttachment =
  PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta> & {
    _attachments: PouchDB.Core.Attachments
  }

export interface Options<P> {
  initialProps?: P
  pouchdb: PouchDB.Database
}

export interface MultiDbOptions<P> {
  initialProps?: P
  main: PouchDB.Database
  other: PouchDB.Database
}

export function renderHook<P, R>(
  callback: (props: P) => R,
  options?: Options<P>
): RenderHookResult<P, R> {
  const optionsObject: RenderHookOptions<P> | undefined =
    options != null
      ? {
          initialProps: options.initialProps,
          wrapper: function Wrapper({ children }) {
            return <Provider pouchdb={options.pouchdb}>{children}</Provider>
          },
        }
      : undefined

  return testingLibraryRenderHook(callback, optionsObject)
}

export function renderHookWithMultiDbContext<P, R>(
  callback: (props: P) => R,
  options: MultiDbOptions<P>
): RenderHookResult<P, R> {
  const optionsObject: RenderHookOptions<P> = {
    initialProps: options.initialProps,
    wrapper: function Wrapper({ children }) {
      return (
        <Provider
          databases={{ main: options.main, other: options.other }}
          default="main"
        >
          {children}
        </Provider>
      )
    },
  }

  return testingLibraryRenderHook(callback, optionsObject)
}
