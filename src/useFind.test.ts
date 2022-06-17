import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import find from 'pouchdb-find'

import {
  renderHook,
  renderHookWithMultiDbContext,
  waitForNextUpdate,
  waitForLoadingChange,
  act,
} from './test-utils'
import useFind, { FindHookIndexOption } from './useFind'

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

describe('by id', () => {
  test('should return docs sorted by _id', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          selector: { _id: { $gte: 'DS9' } },
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

    await waitForLoadingChange(result, false)

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

  test('should subscribe to changes', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          selector: { _id: { $gte: 'DS9' } },
          sort: ['_id'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    act(() => {
      myPouch.put({
        _id: 'AA',
        other: 'value',
      })
    })

    await new Promise(resolve => {
      setTimeout(resolve, 10)
    })
    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    act(() => {
      myPouch.put({
        _id: 'zzz',
        moar: 42,
      })
    })

    await waitForLoadingChange(result, false)
    await waitForNextUpdate(result)

    expect(result.current.docs).toHaveLength(6)
  })

  test('should re-query if a change did happen while a query is underway', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          selector: { _id: { $gte: 'DS9' } },
          sort: ['_id'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    act(() => {
      myPouch.put({
        _id: 'Jolly Roger',
        captain: 'Hook',
      })
    })

    act(() => {
      myPouch.put({ _id: 'test', captain: 'Ching Shih (石陽)' })
    })

    await waitForNextUpdate(result)

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(7)
  })

  test('should handle the deletion of docs in the result', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          selector: { _id: { $gte: 'DS9' } },
          sort: ['_id'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    const doc = await myPouch.get('TOS')
    act(() => {
      myPouch.remove(doc._id, doc._rev)
    })

    await waitForLoadingChange(result, false)
    await waitForNextUpdate(result)

    expect(result.current.docs).toHaveLength(4)
    expect(result.current.loading).toBeFalsy()
  })

  test("shouldn't re-query if a document not in the result gets deleted", async () => {
    await createDocs()

    const docToDelete = await myPouch.put({ _id: 'AA', other: 42 })

    const { result } = renderHook(
      () =>
        useFind({
          selector: { _id: { $gte: 'DS9' } },
          sort: ['_id'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    const current = result.current
    act(() => {
      myPouch.remove(docToDelete.id, docToDelete.rev)
    })

    await waitForLoadingChange(result, false)
    expect(result.current.docs).toHaveLength(5)
    expect(result.current).toBe(current)
  })

  test('should re-query when the selector changes', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (id: string) =>
        useFind({
          selector: { _id: { $gte: id } },
          sort: ['_id'],
        }),
      {
        initialProps: 'DS9',
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.docs).toHaveLength(5)

    rerender('ENT')

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate(result)

    expect(result.current.docs).toHaveLength(4)
  })

  test("shouldn't re-query when the selector changes, but not it's value", async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (selector: PouchDB.Find.Selector) =>
        useFind({
          selector,
          sort: ['_id'],
        }),
      {
        initialProps: { _id: { $gte: 'DS9' } },
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.docs).toHaveLength(5)

    const current = result.current
    rerender({ _id: { $gte: 'DS9' } })

    await waitForLoadingChange(result, false)
    expect(result.current.docs).toHaveLength(5)
    expect(result.current).toBe(current)
  })
})

describe('index', () => {
  test('should use a existing index', async () => {
    await createDocs()

    await myPouch.createIndex({
      index: {
        fields: ['captain'],
      },
    })

    const { result } = renderHook(
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

    await waitForLoadingChange(result, false)

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

    const { result } = renderHook(
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

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
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

    const { result } = renderHook(
      () =>
        useFind({
          selector: {
            captain: { $gt: null },
          },
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

    expect(typeof result.current.warning).toBe('string')
    expect(result.current.warning?.length).toBeGreaterThan(0)
    expect(result.current.docs).toHaveLength(5)
  })

  test("shouldn't warn if an index already exist", async () => {
    await createDocs()

    await myPouch.createIndex({
      index: {
        fields: ['captain'],
      },
    })

    const { result } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
        }),
      {
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

    expect(result.current.warning).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)
  })

  test('should remove warn if an index gets created', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (index?: FindHookIndexOption) =>
        useFind({
          index,
          selector: {
            captain: { $gt: null },
          },
        }),
      {
        initialProps: undefined,
        pouchdb: myPouch,
      }
    )

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

    expect(result.current.warning).toBeTruthy()
    expect(result.current.docs).toHaveLength(5)

    rerender({
      fields: ['captain'],
    })

    await waitForLoadingChange(result, false)

    expect(result.current.warning).toBeUndefined()
    expect(result.current.docs).toHaveLength(5)
  })

  test('should create an index with the provided name and ddoc', async () => {
    await createDocs()

    const { result } = renderHook(
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

    await waitForLoadingChange(result, false)

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

    const { result, rerender } = renderHook(
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

    await waitForLoadingChange(result, false)
    expect(result.current.loading).toBeFalsy()

    rerender(['name'])

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

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

    const { result, rerender } = renderHook(
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
        initialProps: { ddoc: 'star_trek', name: 'captains' },
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()

    rerender({ ddoc: 'star_trek', name: 'other' })

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    rerender({ ddoc: 'star', name: 'other' })

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    const starTrek = await myPouch.get<Record<string, Record<string, unknown>>>(
      '_design/star_trek'
    )
    expect(Object.keys(starTrek.views)).toEqual(['captains', 'other'])

    const starDDoc = await myPouch.get<Record<string, Record<string, unknown>>>(
      '_design/star'
    )
    expect(Object.keys(starDDoc.views)).toEqual(['other'])
  })

  test('should subscribe to changes', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: '' },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.error).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    act(() => {
      myPouch.put({
        _id: 'aa',
        other: 'value',
      })
    })

    await new Promise(resolve => {
      setTimeout(resolve, 20)
    })
    expect(result.current.error).toBeFalsy()
    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    act(() => {
      myPouch.put({
        _id: 'zzz',
        captain: 'Captain Hook',
      })
    })

    await waitForNextUpdate(result)

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.error).toBeFalsy()
    expect(result.current.docs).toHaveLength(6)
  })

  test('should re-query if a change did happen while a query is underway', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: '' },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    act(() => {
      myPouch.put({
        _id: 'Jolly Roger',
        captain: 'Hook',
      })
    })

    act(() => {
      myPouch.put({ _id: 'test', captain: 'Ching Shih (石陽)' })
    })

    await waitForNextUpdate(result)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(7)
  })

  test('should handle the deletion of docs in the result', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: '' },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    const doc = await myPouch.get('TOS')
    act(() => {
      myPouch.remove(doc._id, doc._rev)
    })

    await waitForNextUpdate(result)

    await waitForLoadingChange(result, false)
    expect(result.current.docs).toHaveLength(4)
    expect(result.current.loading).toBeFalsy()
  })

  test("shouldn't re-query if a document not in the result gets deleted", async () => {
    await createDocs()

    const docToDelete = await myPouch.post({ other: 42 })

    const { result } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: '' },
          },
          sort: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)
    expect(result.current.loading).toBeFalsy()

    const current = result.current
    act(() => {
      myPouch.remove(docToDelete.id, docToDelete.rev)
    })

    await waitForLoadingChange(result, false)
    expect(result.current.docs).toHaveLength(5)
    expect(result.current).toBe(current)
  })

  test('should re-query when the selector changes', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (name: string | null) =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: name },
          },
          sort: ['captain'],
        }),
      {
        initialProps: null as null | string,
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)

    rerender('Jonathan Archer')

    expect(result.current.loading).toBeTruthy()

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(1)
  })

  test("shouldn't re-query when the index changes, but not it's value", async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (options: PouchDB.Find.CreateIndexOptions) =>
        useFind({
          index: options.index,
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
        }),
      {
        initialProps: {
          index: {
            fields: ['captain'],
          },
        },
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    const current = result.current
    rerender({
      index: {
        fields: ['captain'],
      },
    })

    await waitForLoadingChange(result, false)
    expect(result.current.docs).toHaveLength(5)
    expect(result.current).toBe(current)
  })

  test("shouldn't re-query when the selector changes, but not it's value", async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (selector: PouchDB.Find.Selector) =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector,
          sort: ['captain'],
        }),
      {
        initialProps: {
          captain: { $gt: null },
        },
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toHaveLength(5)

    const current = result.current
    rerender({
      captain: { $gt: null },
    })

    await waitForLoadingChange(result, false)
    expect(result.current.docs).toHaveLength(5)
    expect(result.current).toBe(current)
  })
})

describe('options', () => {
  test('should only return fields in fields', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (fields: string[]) =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
          fields,
        }),
      {
        initialProps: ['captain'],
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toEqual([
      { captain: 'Benjamin Sisko' },
      { captain: 'James T. Kirk' },
      { captain: 'Jean-Luc Picard' },
      { captain: 'Jonathan Archer' },
      { captain: 'Kathryn Janeway' },
    ])

    rerender(['_id', 'aired'])

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toEqual([
      { _id: 'DS9', aired: 1993 },
      { _id: 'TOS', aired: 1966 },
      { _id: 'TNG', aired: 1987 },
      { _id: 'ENT', aired: 2001 },
      { _id: 'VOY', aired: 1995 },
    ])
  })

  test('should handle the deletion of result docs if _id in not in fields', async () => {
    await createDocs()

    const { result } = renderHook(
      () =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
          fields: ['captain'],
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(5)

    const doc = await myPouch.get('TOS')
    act(() => {
      myPouch.remove(doc._id, doc._rev)
    })

    await waitForLoadingChange(result, false)
    await waitForNextUpdate(result)

    expect(result.current.docs).toHaveLength(4)
  })

  test('should handle limit', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (limit: number) =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
          limit,
        }),
      {
        initialProps: 4,
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(4)
    expect(result.current.docs[3]).toEqual({
      _id: 'ENT',
      _rev: expect.anything(),
      aired: 2001,
      captain: 'Jonathan Archer',
      name: 'Enterprise',
    })

    rerender(2)

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(2)
    expect(result.current.docs[1]._id).toBe('TOS')
  })

  test('should handle skip', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (skip: number) =>
        useFind({
          index: {
            fields: ['captain'],
          },
          selector: {
            captain: { $gt: null },
          },
          sort: ['captain'],
          skip,
        }),
      {
        initialProps: 4,
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(1)
    expect(result.current.docs).toEqual([
      {
        _id: 'VOY',
        _rev: expect.anything(),
        aired: 1995,
        captain: 'Kathryn Janeway',
        name: 'Voyager',
      },
    ])

    rerender(2)

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toHaveLength(3)
    expect(result.current.docs[0]).toEqual({
      _id: 'TNG',
      _rev: expect.anything(),
      aired: 1987,
      captain: 'Jean-Luc Picard',
      name: 'The Next Generation',
    })
  })

  test('should support partial_filter_selector', async () => {
    await createDocs()

    const { result, rerender } = renderHook(
      (year: number) =>
        useFind({
          index: {
            fields: ['aired'],
            partial_filter_selector: {
              aired: {
                $gt: year,
              },
            },
          },
          selector: {
            aired: { $gt: null },
          },
          fields: ['_id', 'aired'],
        }),
      {
        initialProps: 1990,
        pouchdb: myPouch,
      }
    )

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toEqual([
      { _id: 'DS9', aired: 1993 },
      { _id: 'VOY', aired: 1995 },
      { _id: 'ENT', aired: 2001 },
    ])

    rerender(1980)

    await waitForLoadingChange(result, false)

    expect(result.current.docs).toEqual([
      { _id: 'TNG', aired: 1987 },
      { _id: 'DS9', aired: 1993 },
      { _id: 'VOY', aired: 1995 },
      { _id: 'ENT', aired: 2001 },
    ])
  })

  test('should support the selection of a database in the context to be used', async () => {
    const other = new PouchDB('other', { adapter: 'memory' })

    await myPouch.put({
      _id: 'test',
      value: 'myPouch',
    })

    await other.put({
      _id: 'test',
      value: 'other',
    })

    const { result, rerender } = renderHookWithMultiDbContext(
      (name?: string) =>
        useFind({
          index: {
            fields: ['value'],
          },
          selector: {
            value: { $gt: null },
          },
          db: name,
        }),
      {
        initialProps: undefined,
        main: myPouch,
        other: other,
      }
    )

    await waitForLoadingChange(result, false)

    // No db selection
    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toEqual([
      {
        _id: 'test',
        _rev: expect.anything(),
        value: 'myPouch',
      },
    ])

    // selecting a database that is not the default
    rerender('other')
    expect(result.current.loading).toBeTruthy()
    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toEqual([
      {
        _id: 'test',
        _rev: expect.anything(),
        value: 'other',
      },
    ])

    // selecting the default db by it's name
    rerender('main')
    expect(result.current.loading).toBeTruthy()
    await waitForLoadingChange(result, false)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.docs).toEqual([
      {
        _id: 'test',
        _rev: expect.anything(),
        value: 'myPouch',
      },
    ])

    // reset to other db
    rerender('other')
    expect(result.current.loading).toBeTruthy()
    await waitForLoadingChange(result, false)

    // selecting by special _default key
    rerender('_default')
    await waitForLoadingChange(result, false)

    expect(result.current.docs).toEqual([
      {
        _id: 'test',
        _rev: expect.anything(),
        value: 'myPouch',
      },
    ])

    await other.destroy()
  })
})
