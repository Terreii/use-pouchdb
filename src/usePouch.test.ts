import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { renderHook } from './test-utils'
import usePouch from './usePouch'

PouchDB.plugin(memory)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() => usePouch())

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should return the pouchdb from the provider', () => {
  const { result } = renderHook(() => usePouch(), {
    pouchdb: myPouch,
  })

  expect(result.current).toBe(myPouch)
})
