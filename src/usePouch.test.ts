import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { renderHook, renderHookWithMultiDbContext } from './test-utils'
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

test('should support the selection of a database in the context to be used', async () => {
  const other = new PouchDB('other', { adapter: 'memory' })

  const { result, rerender } = renderHookWithMultiDbContext(
    (name?: string) => usePouch(name),
    {
      initialProps: undefined,
      main: myPouch,
      other,
    }
  )

  // No db selection
  expect(result.current).toBe(myPouch)

  // selecting a database that is not the default
  rerender('other')
  expect(result.current).toBe(other)

  // selecting the default db by it's name
  rerender('main')
  expect(result.current).toBe(myPouch)

  // reset to other db
  rerender('other')

  // selecting by special _default key
  rerender('_default')
  expect(result.current).toBe(myPouch)

  await other.destroy()
})
