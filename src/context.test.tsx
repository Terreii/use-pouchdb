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

  expect(result.current.pouchdb).toBe(myPouch)
  expect(typeof result.current.subscriptionManager).toBe('object')
  expect(typeof result.current.subscriptionManager.subscribeToDocs).toBe(
    'function'
  )
  expect(typeof result.current.subscriptionManager.subscribeToView).toBe(
    'function'
  )
})

test('should unsubscribe all when the database changes', () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })
  let db = myPouch

  const { result, rerender } = renderHook(() => useContext(PouchContext), {
    wrapper: ({ children }) => <Provider pouchdb={db}>{children}</Provider>,
  })

  const unsubscribe = jest.fn()
  result.current.subscriptionManager.unsubscribeAll = unsubscribe

  db = new PouchDB('test2', { adapter: 'memory' })

  rerender()

  expect(unsubscribe).toHaveBeenCalled()

  myPouch.destroy()
  db.destroy()
})

test('should unsubscribe all when a database gets destroyed', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result } = renderHook(() => useContext(PouchContext), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  const unsubscribe = jest.fn()
  result.current.subscriptionManager.unsubscribeAll = unsubscribe

  myPouch.destroy()

  await new Promise(resolve => {
    setTimeout(resolve, 10)
  })

  expect(unsubscribe).toHaveBeenCalled()
})
