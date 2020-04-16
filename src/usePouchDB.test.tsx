import React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { Provider } from './context'
import usePouchDB from './usePouchDB'

PouchDB.plugin(memory)

test('should return the pouchdb from the provider', () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result } = renderHook(() => usePouchDB(), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.current).toBe(myPouch)
})
