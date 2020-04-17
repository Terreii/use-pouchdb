import React from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { Provider } from './context'
import useDoc from './useDoc'

PouchDB.plugin(memory)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should return a doc', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result, waitForNextUpdate } = renderHook(() => useDoc('test'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.current.doc).toBeFalsy()
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.doc).toBeTruthy()
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.state).toBe('done')
})

test('should return a default value while first loading', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result, waitForNextUpdate } = renderHook(
    () => useDoc('test', null, { other: 'doc' }),
    {
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  expect(result.current.doc).toEqual({ other: 'doc' })
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)
})

test('should return a default value from a function while first loading', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result, waitForNextUpdate } = renderHook(
    () => useDoc('test', null, () => ({ other: 'doc' })),
    {
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  expect(result.current.doc).toEqual({ other: 'doc' })
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)
})

test("should return a error if the doc doesn't exist", async () => {
  const { result, waitForNextUpdate } = renderHook(() => useDoc('test'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.current.doc).toBeFalsy()
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.doc).toBeFalsy()
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.state).toBe(404)
})

test('should continue to return the default value in error-state', async () => {
  const { result, waitForNextUpdate } = renderHook(
    () => useDoc('test', null, () => ({ other: 'doc' })),
    {
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  expect(result.current.doc).toEqual({ other: 'doc' })
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.doc).toEqual({ other: 'doc' })
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.state).toBe(404)
})

test('should subscribe to updates of the document', async () => {
  const putResult = await myPouch.put({
    _id: 'test',
    value: 42,
    greetings: 'Hello You!',
  })

  const { result, waitForNextUpdate } = renderHook(() => useDoc('test'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

  act(() => {
    myPouch.put({
      _id: 'test',
      _rev: putResult.rev,
      value: 43,
      greetings: 'to you, too!',
    })
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(43)
  expect(result.current.doc.greetings).toBe('to you, too!')
})

test('should update when a none existing document is created', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useDoc('test'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  await waitForNextUpdate()

  expect(result.current.doc).toBeFalsy()
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.state).toBe(404)

  act(() => {
    myPouch.put({
      _id: 'test',
      value: 42,
      greetings: 'Hello You!',
    })
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.doc).toBeFalsy()

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)
  expect(result.current.doc.greetings).toBe('Hello You!')
})

test('should return the last doc when id did change and no initial value is passed', async () => {
  await myPouch.bulkDocs([
    { _id: 'test', value: 42, greetings: 'Hello You!' },
    { _id: 'other', value: 'changed' },
  ])

  const { result, waitForNextUpdate, rerender } = renderHook(id => useDoc(id), {
    initialProps: 'test',
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  await waitForNextUpdate()

  expect(result.current.doc._id).toBe('test')

  rerender('other')

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')
  expect(result.current.doc._id).toBe('test')

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('other')
  expect(result.current.doc.value).toBe('changed')
})

test('should return the initial value when id did change', async () => {
  await myPouch.bulkDocs([
    { _id: 'test', value: 42, greetings: 'Hello You!' },
    { _id: 'other', value: 'changed' },
  ])

  const { result, waitForNextUpdate, rerender } = renderHook(
    id => useDoc(id, null, () => ({ value: 'initial' })),
    {
      initialProps: 'test',
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  await waitForNextUpdate()

  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

  rerender('other')

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')
  expect(result.current.doc._id).toBeFalsy()
  expect(result.current.doc.value).toBe('initial')

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('other')
  expect(result.current.doc.value).toBe('changed')
})
