import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import find from 'pouchdb-find'

import { renderHook } from './test-utils'
import useFind from './useFind'

PouchDB.plugin(memory)
PouchDB.plugin(find)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

function createDocs() {
  return myPouch.bulkDocs([
    {
      _id: 'TOS',
      name: 'The Original Series',
      captain: 'James T. Kirk',
      aired: 1966,
    },
    {
      _id: 'TNG',
      name: 'The Next Generation',
      captain: 'Jean-Luc Picard',
      aired: 1987,
    },
    {
      _id: 'DS9',
      name: 'Deep Space Nine',
      captain: 'Benjamin Sisko',
      aired: 1993,
    },
    { _id: 'VOY', name: 'Voyager', captain: 'Kathryn Janeway', aired: 1995 },
    { _id: 'ENT', name: 'Enterprise', captain: 'Jonathan Archer', aired: 2001 },
  ])
}

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() =>
    useFind({
      selector: { _id: { $gte: 'dk' } },
      sort: ['_id'],
    })
  )

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should return an error if the PouchDB database as no createIndex', () => {
  myPouch.createIndex = undefined

  const { result } = renderHook(
    () =>
      useFind({
        index: { fields: ['name'] },
        selector: { name: { $gt: null } },
        sort: ['name'],
      }),
    {
      pouchdb: myPouch,
    }
  )

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'db.createIndex() or/and db.find() are not defined. Please install "pouchdb-find"'
  )
})

test('should return an error if the PouchDB database as no find', () => {
  myPouch.find = undefined

  const { result } = renderHook(
    () =>
      useFind({
        index: { fields: ['name'] },
        selector: { name: { $gt: null } },
        sort: ['name'],
      }),
    {
      pouchdb: myPouch,
    }
  )

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'db.createIndex() or/and db.find() are not defined. Please install "pouchdb-find"'
  )
})

test('should return docs sorted by _id', async () => {
  await createDocs()

  const { result, waitForNextUpdate } = renderHook(
    () =>
      useFind({
        selector: { _id: { $gte: 'Episode 1' } },
        sort: ['_id'],
      }),
    {
      pouchdb: myPouch,
    }
  )

  expect(result.current.docs).toEqual([])
  expect(result.current.warning).toBeFalsy()
  expect(result.current.loading).toBeTruthy()
  expect(result.current.state).toBe('loading')
  expect(result.current.error).toBeNull()

  await waitForNextUpdate()

  expect(result.current.docs).toEqual([
    {
      _id: 'DS9',
      _rev: expect.anything(),
      name: 'Deep Space Nine',
      captain: 'Benjamin Sisko',
      aired: 1993,
    },
    {
      _id: 'ENT',
      _rev: expect.anything(),
      name: 'Enterprise',
      captain: 'Jonathan Archer',
      aired: 2001,
    },
    {
      _id: 'TNG',
      _rev: expect.anything(),
      name: 'The Next Generation',
      captain: 'Jean-Luc Picard',
      aired: 1987,
    },
    {
      _id: 'TOS',
      _rev: expect.anything(),
      name: 'The Original Series',
      captain: 'James T. Kirk',
      aired: 1966,
    },
    {
      _id: 'VOY',
      _rev: expect.anything(),
      name: 'Voyager',
      captain: 'Kathryn Janeway',
      aired: 1995,
    },
  ])
  expect(result.current.warning).toBeFalsy()
  expect(result.current.loading).toBeFalsy()
  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
})

describe('index', () => {
  test('should use a existing index', async () => {
    await createDocs()

    await myPouch.createIndex({
      index: {
        fields: ['captain'],
      },
    })

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useFind({
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.warning).toBeFalsy()
    expect(result.current.docs).toEqual([
      {
        _id: 'DS9',
        _rev: expect.anything(),
        name: 'Deep Space Nine',
        captain: 'Benjamin Sisko',
        aired: 1993,
      },
      {
        _id: 'TOS',
        _rev: expect.anything(),
        name: 'The Original Series',
        captain: 'James T. Kirk',
        aired: 1966,
      },
      {
        _id: 'TNG',
        _rev: expect.anything(),
        name: 'The Next Generation',
        captain: 'Jean-Luc Picard',
        aired: 1987,
      },
      {
        _id: 'ENT',
        _rev: expect.anything(),
        name: 'Enterprise',
        captain: 'Jonathan Archer',
        aired: 2001,
      },
      {
        _id: 'VOY',
        _rev: expect.anything(),
        name: 'Voyager',
        captain: 'Kathryn Janeway',
        aired: 1995,
      },
    ])
  })

  test('should create an index and use it', async () => {
    await createDocs()

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.warning).toBeFalsy()
    expect(result.current.docs).toEqual([
      {
        _id: 'DS9',
        _rev: expect.anything(),
        name: 'Deep Space Nine',
        captain: 'Benjamin Sisko',
        aired: 1993,
      },
      {
        _id: 'TOS',
        _rev: expect.anything(),
        name: 'The Original Series',
        captain: 'James T. Kirk',
        aired: 1966,
      },
      {
        _id: 'TNG',
        _rev: expect.anything(),
        name: 'The Next Generation',
        captain: 'Jean-Luc Picard',
        aired: 1987,
      },
      {
        _id: 'ENT',
        _rev: expect.anything(),
        name: 'Enterprise',
        captain: 'Jonathan Archer',
        aired: 2001,
      },
      {
        _id: 'VOY',
        _rev: expect.anything(),
        name: 'Voyager',
        captain: 'Kathryn Janeway',
        aired: 1995,
      },
    ])
  })

  test('should warn if no index exist', async () => {
    await createDocs()

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useFind({
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(typeof result.current.warning).toBe('string')
    expect(result.current.warning.length).toBeGreaterThan(0)
    expect(result.current.docs).toHaveLength(5)
  })

  test("shouldn't warn if an index already exist", async () => {
    await createDocs()

    await myPouch.createIndex({
      index: {
        fields: ['captain'],
      },
    })

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.warning).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)
  })

  test('should create an index with the provided name and ddoc', async () => {
    await createDocs()

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
            ddoc: 'star_trek',
            name: 'captains',
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.warning).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    const ddoc = await myPouch.get<Record<string, unknown>>('_design/star_trek')
    expect(ddoc).toBeTruthy()
    expect(ddoc.language).toBe('query')
    expect(typeof ddoc.views).toBe('object')
    expect(typeof (ddoc.views as Record<string, unknown>).captains).toBe(
      'object'
    )
  })

  test('should create a new index if fields change', async () => {
    await createDocs()

    const { result, waitForNextUpdate, rerender } = renderHook(
      (fields: string[]) =>
        useFind({
          index: {
            fields,
          },
          selector: {
            [fields[0]]: { $gt: null },
          },
          sort: fields,
        }),
      {
        initialProps: ['captain'],
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()
    expect(result.current.loading).toBeFalsy()

    rerender(['name'])

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toEqual([
      {
        _id: 'DS9',
        _rev: expect.anything(),
        name: 'Deep Space Nine',
        captain: 'Benjamin Sisko',
        aired: 1993,
      },
      {
        _id: 'ENT',
        _rev: expect.anything(),
        name: 'Enterprise',
        captain: 'Jonathan Archer',
        aired: 2001,
      },
      {
        _id: 'TNG',
        _rev: expect.anything(),
        name: 'The Next Generation',
        captain: 'Jean-Luc Picard',
        aired: 1987,
      },
      {
        _id: 'TOS',
        _rev: expect.anything(),
        name: 'The Original Series',
        captain: 'James T. Kirk',
        aired: 1966,
      },
      {
        _id: 'VOY',
        _rev: expect.anything(),
        name: 'Voyager',
        captain: 'Kathryn Janeway',
        aired: 1995,
      },
    ])

    expect((await myPouch.getIndexes()).indexes).toHaveLength(3)
  })

  test('should create a new index if name or ddoc change', async () => {
    await createDocs()

    const { result, waitForNextUpdate, rerender } = renderHook(
      ({ name, ddoc }: { name: string; ddoc: string }) =>
        useFind({
          index: {
            fields: ['captain'],
            name,
            ddoc,
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        initialProps: { ddoc: 'star_trak', name: 'captains' },
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()
    expect(result.current.loading).toBeFalsy()

    rerender({ ddoc: 'star_trak', name: 'other' })

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    rerender({ ddoc: 'star', name: 'other' })

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    const starTrak = await myPouch.get<Record<string, unknown>>(
      '_design/star_trak'
    )
    expect(Object.keys(starTrak.views)).toEqual(['captains', 'other'])

    const starDDoc = await myPouch.get<Record<string, unknown>>('_design/star')
    expect(Object.keys(starDDoc.views)).toEqual(['other'])
  })
})
