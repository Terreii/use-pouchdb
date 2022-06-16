import React from 'react'
import {
  renderHook as testingLibraryRenderHook,
  waitFor,
  RenderHookResult,
  RenderHookOptions,
} from '@testing-library/react'

import { Provider } from './context'

export * from '@testing-library/react'

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
): RenderHookResult<R, P> {
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
): RenderHookResult<R, P> {
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

export async function waitForNextUpdate<T = unknown>(result: {
  current: T
}): Promise<void> {
  const currentResult = result.current
  await waitFor(() => {
    expect(result.current).not.toBe(currentResult)
  })
}

export async function waitForLoadingChange(
  result: { current: { loading: boolean } },
  desiredState: boolean
): Promise<void> {
  await waitFor(() => {
    expect(result.current.loading).toBe(desiredState)
  })
}
