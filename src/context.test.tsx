import { renderHook } from '@testing-library/react-hooks'
import React from 'react'
import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { Provider, useContext } from './context'

PouchDB.plugin(memory)

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() => useContext())

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should render a Provider which provide the passed pouchdb database', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result } = renderHook(() => useContext(), {
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return <Provider pouchdb={myPouch}>{children}</Provider>
    },
  })

  expect(result.current.pouchdb).toBe(myPouch)
  expect(typeof result.current.getSubscriptionManager).toBe('function')
  expect(typeof result.current.getSubscriptionManager().subscribeToDocs).toBe(
    'function'
  )
  expect(typeof result.current.getSubscriptionManager().subscribeToView).toBe(
    'function'
  )

  await myPouch.destroy()
})

test('should unsubscribe all when the database changes', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })
  let db = myPouch

  const { result, rerender } = renderHook(() => useContext(), {
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return <Provider pouchdb={db}>{children}</Provider>
    },
  })

  const unsubscribe = jest.fn()
  result.current.getSubscriptionManager().unsubscribeAll = unsubscribe

  db = new PouchDB('test2', { adapter: 'memory' })

  rerender()

  await new Promise(resolve => {
    setTimeout(resolve, 10)
  })

  expect(unsubscribe).toHaveBeenCalled()

  await myPouch.destroy()
  await db.destroy()
})

test('should unsubscribe all when a database gets destroyed', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result } = renderHook(() => useContext(), {
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return <Provider pouchdb={myPouch}>{children}</Provider>
    },
  })

  const unsubscribe = jest.fn()
  result.current.getSubscriptionManager().unsubscribeAll = unsubscribe

  await myPouch.destroy()

  await new Promise(resolve => {
    setTimeout(resolve, 10)
  })

  expect(unsubscribe).toHaveBeenCalled()
})

test('should throw an error if a wrong name is passed to useContext', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result, rerender } = renderHook((name?: string) => useContext(name), {
    initialProps: undefined,
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return <Provider pouchdb={myPouch}>{children}</Provider>
    },
  })

  expect(result.error).toBeUndefined()

  rerender('not-existing')

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find a PouchDB database with name of "not-existing"'
  )

  rerender('_default')

  expect(result.error).toBeUndefined()

  rerender('test')

  expect(result.error).toBeUndefined()

  await myPouch.destroy()
})

test('should use the optional name argument', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })

  const { result, rerender } = renderHook((name: string) => useContext(name), {
    initialProps: 'other',
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <Provider pouchdb={myPouch} name="other">
          {children}
        </Provider>
      )
    },
  })

  expect(result.current.pouchdb).toBe(myPouch)

  rerender('test')

  expect(result.error).toBeInstanceOf(Error)

  await myPouch.destroy()
})

test('should render a Provider that gives access to multiple databases', async () => {
  const myPouch = new PouchDB('test', { adapter: 'memory' })
  const other = new PouchDB('other', { adapter: 'memory' })

  const { result, rerender } = renderHook((name?: string) => useContext(name), {
    initialProps: undefined,
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <Provider databases={{ myPouch, other }} default="myPouch">
          {children}
        </Provider>
      )
    },
  })

  expect(result.current.pouchdb).toBe(myPouch)

  const myPouchSubscriptionManager = result.current.getSubscriptionManager()

  rerender('other')

  expect(result.current.pouchdb).toBe(other)
  expect(result.current.getSubscriptionManager()).not.toBe(
    myPouchSubscriptionManager
  )

  rerender('myPouch')

  expect(result.current.pouchdb).toBe(myPouch)
  expect(result.current.getSubscriptionManager()).toBe(
    myPouchSubscriptionManager
  )

  await myPouch.destroy()
  await other.destroy()
})

test('should combine a parent context into its context', async () => {
  const parent = new PouchDB('test', { adapter: 'memory' })
  const child = new PouchDB('other', { adapter: 'memory' })

  const { result, rerender } = renderHook((name?: string) => useContext(name), {
    initialProps: undefined,
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <Provider pouchdb={parent}>
          <Provider pouchdb={child}>{children}</Provider>
        </Provider>
      )
    },
  })

  expect(result.current.pouchdb).toBe(child)
  const childSubscriptionManager = result.current.getSubscriptionManager()

  rerender('test')

  expect(result.current.pouchdb).toBe(parent)
  expect(result.current.getSubscriptionManager()).not.toBe(
    childSubscriptionManager
  )

  rerender('other')

  expect(result.current.pouchdb).toBe(child)
  expect(result.current.getSubscriptionManager()).toBe(childSubscriptionManager)

  rerender('_default')

  expect(result.current.pouchdb).toBe(child)
  expect(result.current.getSubscriptionManager()).toBe(childSubscriptionManager)

  await parent.destroy()
  await child.destroy()
})

test('should combine a parent context into its context if the child is multi db', async () => {
  const parent = new PouchDB('test', { adapter: 'memory' })
  const child = new PouchDB('other', { adapter: 'memory' })

  const { result, rerender } = renderHook((name?: string) => useContext(name), {
    initialProps: undefined,
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <Provider pouchdb={parent}>
          <Provider databases={{ other: child }} default="other">
            {children}
          </Provider>
        </Provider>
      )
    },
  })

  expect(result.current.pouchdb).toBe(child)
  const childSubscriptionManager = result.current.getSubscriptionManager()

  rerender('test')

  expect(result.current.pouchdb).toBe(parent)
  expect(result.current.getSubscriptionManager()).not.toBe(
    childSubscriptionManager
  )

  rerender('other')

  expect(result.current.pouchdb).toBe(child)
  expect(result.current.getSubscriptionManager()).toBe(childSubscriptionManager)

  rerender('_default')

  expect(result.current.pouchdb).toBe(child)
  expect(result.current.getSubscriptionManager()).toBe(childSubscriptionManager)

  await parent.destroy()
  await child.destroy()
})

test('should allow the use of a parent context database name in default', async () => {
  const parent = new PouchDB('test', { adapter: 'memory' })
  const child = new PouchDB('other', { adapter: 'memory' })

  const { result } = renderHook((name?: string) => useContext(name), {
    initialProps: undefined,
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <Provider pouchdb={parent}>
          <Provider databases={{ other: child }} default="test">
            {children}
          </Provider>
        </Provider>
      )
    },
  })

  expect(result.current.pouchdb).toBe(parent)

  await parent.destroy()
  await child.destroy()
})

test('should handle a database name of default', async () => {
  const myPouch = new PouchDB('default', { adapter: 'memory' })
  const other = new PouchDB('other', { adapter: 'memory' })

  const { result, rerender } = renderHook((name?: string) => useContext(name), {
    initialProps: undefined,
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <Provider databases={{ default: myPouch, other }} default="other">
          {children}
        </Provider>
      )
    },
  })

  expect(result.current.pouchdb).toBe(other)

  rerender('default')

  expect(result.current.pouchdb).toBe(myPouch)

  rerender('_default')

  expect(result.current.pouchdb).toBe(other)

  await myPouch.destroy()
  await other.destroy()
})
