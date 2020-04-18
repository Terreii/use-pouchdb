import React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { Provider } from './context'
import usePouchDB from './usePouchDB'

PouchDB.plugin(memory)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() => usePouchDB())

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should return the pouchdb from the provider', () => {
  const { result } = renderHook(() => usePouchDB(), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.current).toBe(myPouch)
})
