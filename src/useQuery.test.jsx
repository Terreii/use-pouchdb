import React from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import mapReduce from 'pouchdb-mapreduce'

import { Provider } from './context'
import useQuery, { QueryState } from './useQuery'

PouchDB.plugin(memory)
PouchDB.plugin(mapReduce)

let myPouch = null

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should call query on the pouchdb instance of the provider', () => {
  const query = myPouch.query
  myPouch.query = jest.fn(query)

  const { result } = renderHook(() => useQuery('test'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(myPouch.query).toHaveBeenCalled()
})

test('should return an error if the PouchDB database as no query', () => {
  myPouch.query = undefined

  const { result } = renderHook(() => useQuery('test'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'db.query() is not defined. Please install "pouchdb-mapreduce"'
  )
})

test("should query a view and it's result return", async () => {
  await myPouch.bulkDocs([
    { _id: 'a', test: 'value', type: 'tester' },
    { _id: 'b', test: 'other', type: 'checker' },
  ])

  const view = {
    map: (doc, emit) => {
      if (doc.type === 'tester') {
        emit(doc.test, 42)
      }
    },
  }

  const { result, waitForNextUpdate } = renderHook(() => useQuery(view), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  expect(result.current).toEqual({
    error: null,
    loading: true,
    state: 'loading',
    offset: 0,
    rows: [],
    total_rows: 0,
  })

  await waitForNextUpdate()

  expect(result.current).toEqual({
    error: null,
    loading: false,
    state: 'done',
    offset: 0,
    rows: [{ id: 'a', key: 'value', value: 42 }],
    total_rows: 1,
  })
})

test('should query a view from a design document', async () => {
  await myPouch.bulkDocs([
    { _id: 'a', test: 'value', type: 'tester' },
    { _id: 'b', test: 'other', type: 'checker' },
  ])

  const ddoc = {
    _id: '_design/ddoc',
    views: {
      test: {
        map: function (doc) {
          if (doc.type === 'tester') {
            emit(doc.test, 42)
          }
        }.toString(),
      },
    },
  }

  await myPouch.put(ddoc)

  const { result, waitForNextUpdate } = renderHook(
    () => useQuery('ddoc/test'),
    {
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  await waitForNextUpdate()

  expect(result.current).toEqual({
    error: null,
    loading: false,
    state: 'done',
    offset: 0,
    rows: [{ id: 'a', key: 'value', value: 42 }],
    total_rows: 1,
  })
})

test("should result in an error if the view doesn't exist", async () => {
  await myPouch.bulkDocs([
    { _id: 'a', test: 'value', type: 'tester' },
    { _id: 'b', test: 'other', type: 'checker' },
  ])

  const { result, waitForNextUpdate } = renderHook(() => useQuery('view'), {
    wrapper: ({ children }) => (
      <Provider pouchdb={myPouch}>{children}</Provider>
    ),
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.status).toBe(404)
  expect(result.current.error.message).toBe('missing')
  expect(result.current.rows).toEqual([])
})

test('should subscribe to changes to the view', async () => {
  await myPouch.bulkDocs([
    { _id: 'a', test: 'value', type: 'tester' },
    { _id: 'b', test: 'other', type: 'checker' },
  ])

  const ddoc = {
    _id: '_design/ddoc',
    views: {
      test: {
        map: function (doc) {
          if (doc.type === 'tester') {
            emit(doc.test, 42)
          }
        }.toString(),
      },
    },
  }

  await myPouch.put(ddoc)

  const { result, waitForNextUpdate } = renderHook(
    () => useQuery('ddoc/test'),
    {
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([{ id: 'a', key: 'value', value: 42 }])

  await myPouch.put({ _id: 'c', test: 'Hallo!', type: 'tester' })

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')
  expect(result.current.rows).toEqual([{ id: 'a', key: 'value', value: 42 }])

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'value', value: 42 },
    { id: 'c', key: 'Hallo', value: 42 },
  ])
})

test("should query a view if the ddoc didn't exist but then synced", async () => {
  await myPouch.bulkDocs([
    { _id: 'a', test: 'value', type: 'tester' },
    { _id: 'b', test: 'other', type: 'checker' },
  ])

  const ddoc = {
    _id: '_design/ddoc',
    views: {
      test: {
        map: function (doc) {
          if (doc.type === 'tester') {
            emit(doc.test, 42)
          }
        }.toString(),
      },
    },
  }

  const { result, waitForNextUpdate } = renderHook(
    () => useQuery('ddoc/test'),
    {
      wrapper: ({ children }) => (
        <Provider pouchdb={myPouch}>{children}</Provider>
      ),
    }
  )

  await waitForNextUpdate()

  await myPouch.put(ddoc)

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current).toEqual({
    error: null,
    loading: false,
    state: 'done',
    offset: 0,
    rows: [{ id: 'a', key: 'value', value: 42 }],
    total_rows: 1,
  })
})
