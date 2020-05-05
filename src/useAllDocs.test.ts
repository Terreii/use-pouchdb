import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import mapReduce from 'pouchdb-mapreduce'

import { renderHook, act } from './test-utils'
import useAllDocs from './useAllDocs'

PouchDB.plugin(memory)
PouchDB.plugin(mapReduce)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() => useAllDocs())

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should load all documents', async () => {
  const putResult = await myPouch.bulkDocs([
    { _id: 'a', test: 'value' },
    { _id: 'b', test: 'other' },
  ])

  const { result, waitForNextUpdate } = renderHook(() => useAllDocs(), {
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
    rows: [
      { id: 'a', key: 'a', value: { rev: putResult[0].rev } },
      { id: 'b', key: 'b', value: { rev: putResult[1].rev } },
    ],
    total_rows: 2,
  })
})

test('should subscribe to changes', async () => {
  const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
    { _id: 'a', test: 'value' },
    { _id: 'b', test: 'other' },
  ])

  const { result, waitForNextUpdate } = renderHook(() => useAllDocs(), {
    pouchdb: myPouch,
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: revA } },
    { id: 'b', key: 'b', value: { rev: revB } },
  ])

  let revC: string
  let revD: string
  act(() => {
    myPouch
      .bulkDocs([
        { _id: 'c', test: 'Hallo!' },
        { _id: 'd', test: 'world!' },
      ])
      .then(result => {
        revC = result[0].rev
        revD = result[1].rev
      })
  })

  await waitForNextUpdate()

  expect(result.current.loading).toBeTruthy()

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: revA } },
    { id: 'b', key: 'b', value: { rev: revB } },
    { id: 'c', key: 'c', value: { rev: revC } },
    { id: 'd', key: 'd', value: { rev: revD } },
  ])

  let secondUpdateRev = ''
  act(() => {
    myPouch
      .put({
        _id: 'a',
        _rev: revA,
        test: 'newValue',
      })
      .then(result => {
        secondUpdateRev = result.rev
      })
  })

  await waitForNextUpdate()

  expect(result.current.loading).toBeTruthy()

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: secondUpdateRev } },
    { id: 'b', key: 'b', value: { rev: revB } },
    { id: 'c', key: 'c', value: { rev: revC } },
    { id: 'd', key: 'd', value: { rev: revD } },
  ])

  act(() => {
    myPouch.remove('b', revB)
  })

  await waitForNextUpdate()

  expect(result.current.loading).toBeTruthy()

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: secondUpdateRev } },
    { id: 'c', key: 'c', value: { rev: revC } },
    { id: 'd', key: 'd', value: { rev: revD } },
  ])
})

test('should reload if a change did happen while a query is running', async () => {
  const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
    { _id: 'a', test: 'value' },
    { _id: 'b', test: 'other' },
  ])

  const { result, waitForNextUpdate } = renderHook(() => useAllDocs(), {
    pouchdb: myPouch,
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows.map(doc => doc))
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: revA } },
    { id: 'b', key: 'b', value: { rev: revB } },
  ])

  let revC: string
  let revD: string
  act(() => {
    myPouch
      .bulkDocs([
        { _id: 'c', test: 'Hallo!' },
        { _id: 'd', test: 'world!' },
      ])
      .then(result => {
        revC = result[0].rev
        revD = result[1].rev
      })
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('loading')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: revA } },
    { id: 'b', key: 'b', value: { rev: revB } },
  ])

  let revE: string
  act(() => {
    myPouch.put({ _id: 'e', test: 'Hallo!' }).then(result => {
      revE = result.rev
    })
  })

  await waitForNextUpdate()

  expect(result.current.loading).toBeTruthy()
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: revA } },
    { id: 'b', key: 'b', value: { rev: revB } },
    { id: 'c', key: 'c', value: { rev: revC } },
    { id: 'd', key: 'd', value: { rev: revD } },
  ])

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.rows).toEqual([
    { id: 'a', key: 'a', value: { rev: revA } },
    { id: 'b', key: 'b', value: { rev: revB } },
    { id: 'c', key: 'c', value: { rev: revC } },
    { id: 'd', key: 'd', value: { rev: revD } },
    { id: 'e', key: 'e', value: { rev: revE } },
  ])
})
