import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import mapReduce from 'pouchdb-mapreduce'

import { renderHook, act } from './test-utils'
import useQuery from './useQuery'

PouchDB.plugin(memory)
PouchDB.plugin(mapReduce)

let myPouch: PouchDB.Database

// mock for the view emit function
const emit = (_key: any, _value?: any) => {}

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() => useQuery('test'))

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should call query on the pouchdb instance of the provider', () => {
  const query = myPouch.query
  const pouch: any = myPouch
  pouch.query = jest.fn(query)

  renderHook(() => useQuery('test'), {
    pouchdb: myPouch,
  })

  expect(pouch.query).toHaveBeenCalled()
})

test('should return an error if the PouchDB database as no query', () => {
  myPouch.query = undefined

  const { result } = renderHook(() => useQuery('test'), {
    pouchdb: myPouch,
  })

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'db.query() is not defined. Please install "pouchdb-mapreduce"'
  )
})

describe('temporary views', () => {
  test("should query a view and return it's result", async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const view = {
      map: (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      },
    }

    const { result, waitForNextUpdate } = renderHook(() => useQuery(view), {
      pouchdb: myPouch,
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

  test('should subscribe to changes to the view', async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const view = {
      map: (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      },
    }

    const { result, waitForNextUpdate } = renderHook(() => useQuery(view), {
      pouchdb: myPouch,
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'a', key: 'value', value: 42 }])

    act(() => {
      myPouch.bulkDocs([
        { _id: 'c', test: 'Hallo!', type: 'tester' },
        { _id: 'd', test: 'world!', type: 'checker' },
      ])
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')
    expect(result.current.rows).toEqual([{ id: 'a', key: 'value', value: 42 }])

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])
  })
})

describe('design documents', () => {
  test('should query a view from a design document', async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const ddoc = {
      _id: '_design/ddoc',
      views: {
        test: {
          map: function (doc: PouchDB.Core.Document<any>) {
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
        pouchdb: myPouch,
      }
    )

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

  test("should result in an error if the view doesn't exist", async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const { result, waitForNextUpdate } = renderHook(() => useQuery('view'), {
      pouchdb: myPouch,
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
          map: function (doc: PouchDB.Core.Document<any>) {
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
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'a', key: 'value', value: 42 }])

    act(() => {
      myPouch.bulkDocs([
        { _id: 'c', test: 'Hallo!', type: 'tester' },
        { _id: 'd', test: 'world!', type: 'checker' },
      ])
    })

    await waitForNextUpdate()

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])
  })

  test('should result in an error if the ddoc gets deleted', async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const ddoc = {
      _id: '_design/ddoc',
      views: {
        test: {
          map: function (doc: PouchDB.Core.Document<any>) {
            if (doc.type === 'tester') {
              emit(doc.test, 42)
            }
          }.toString(),
        },
      },
    }

    const ddocResult = await myPouch.put(ddoc)

    const { result, waitForNextUpdate } = renderHook(
      () => useQuery('ddoc/test'),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    act(() => {
      myPouch.remove(ddocResult.id, ddocResult.rev)
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error.status).toBe(404)
    expect(result.current.error.message).toBe('missing')
    expect(result.current.rows).toEqual([])
  })

  test("should query a view if the ddoc didn't exist but is then created", async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const ddoc = {
      _id: '_design/ddoc',
      views: {
        test: {
          map: function (doc: PouchDB.Core.Document<any>) {
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
        pouchdb: myPouch,
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
})
