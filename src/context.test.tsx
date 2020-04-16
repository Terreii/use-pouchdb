import { renderHook } from '@testing-library/react-hooks'
import React, { useContext } from 'react'
import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { Provider, PouchContext } from './context'

PouchDB.plugin(memory)

test('should render a Provider which provide the passed pouchdb database', () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result } = renderHook(() => useContext(PouchContext), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.current).toBe(myPouch)
})
