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

describe('options', () => {
  test('should handle the include_docs option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (include_docs: boolean) => useAllDocs({ include_docs }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      {
        id: 'a',
        key: 'a',
        value: { rev: revA },
        doc: { _id: 'a', _rev: revA, test: 'value' },
      },
      {
        id: 'b',
        key: 'b',
        value: { rev: revB },
        doc: { _id: 'b', _rev: revB, test: 'other' },
      },
    ])
  })

  test('should handle the conflicts option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const updateResult = await myPouch.put({
      _id: 'a',
      _rev: revA,
      test: 'update',
      type: 'tester',
    })

    const conflictResult = await myPouch.put(
      {
        _id: 'a',
        _rev: revA,
        test: 'conflict',
        type: 'tester',
      },
      { force: true }
    )

    const { result, waitForNextUpdate, rerender } = renderHook(
      (conflicts: boolean) => useAllDocs({ include_docs: true, conflicts }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows[0].doc._conflicts).toBeUndefined()

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows[0].doc._conflicts).toEqual(
      result.current.rows[0].doc._rev === updateResult.rev
        ? [conflictResult.rev]
        : [updateResult.rev]
    )
    expect(result.current.rows[1].doc._conflicts).toBeUndefined()
  })

  test('should handle the attachments option', async () => {
    await myPouch.bulkDocs([
      {
        _attachments: {
          'info.txt': {
            content_type: 'text/plain',
            data: Buffer.from('Is there life on Mars?\n'),
          },
        },
        _id: 'a',
        test: 'value',
      },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (attachments: boolean) => useAllDocs({ include_docs: true, attachments }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows[0].doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      length: 23,
      revpos: 1,
      stub: true,
    })

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows[0].doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
  })

  test('should handle the binary option', async () => {
    await myPouch.bulkDocs([
      {
        _attachments: {
          'info.txt': {
            content_type: 'text/plain',
            data: Buffer.from('Is there life on Mars?\n'),
          },
        },
        _id: 'a',
        test: 'value',
        type: 'tester',
      },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (binary: boolean) =>
        useAllDocs({
          include_docs: true,
          attachments: true,
          binary,
        }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows[0].doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows[0].doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
  })

  test('should handle the startkey option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (startkey: string) => useAllDocs({ startkey, endkey: 'x' }),
      {
        initialProps: 'b',
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'b', key: 'b', value: { rev: revB } },
    ])

    rerender('a')

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])
  })

  test('should handle the endkey option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (endkey: string) => useAllDocs({ startkey: 'a', endkey }),
      {
        initialProps: 'x',
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])

    rerender('a')

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
    ])
  })

  test('should handle the inclusive_end option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (inclusive_end: boolean) =>
        useAllDocs({ startkey: 'a', endkey: 'b', inclusive_end }),
      {
        initialProps: true,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])

    rerender(false)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
    ])
  })

  test('should handle the limit option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (limit?: number) => useAllDocs({ limit }),
      {
        initialProps: 1,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
    ])

    rerender(5)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])
  })

  test('should handle the skip option', async () => {
    const [{ rev: revA }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (skip?: number) => useAllDocs({ skip }),
      {
        initialProps: 1,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
    ])

    rerender(5)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([])
  })

  test('should handle the descending option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (descending: boolean) => useAllDocs({ descending }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'b', key: 'b', value: { rev: revB } },
      { id: 'a', key: 'a', value: { rev: revA } },
    ])
  })

  test('should handle the key option', async () => {
    const [{ rev: revA }, { rev: revB }] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (key: string) => useAllDocs({ key }),
      {
        initialProps: 'a',
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
    ])

    rerender('b')

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'b', key: 'b', value: { rev: revB } },
    ])
  })

  test('should handle the keys option', async () => {
    const [
      { rev: revA },
      { rev: revB },
      { rev: revC },
    ] = await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
      { _id: 'c', test: 'moar' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (keys: string[]) => useAllDocs({ keys }),
      {
        initialProps: ['a'],
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'a', key: 'a', value: { rev: revA } },
    ])

    rerender(['c', 'b'])

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'c', value: { rev: revC } },
      { id: 'b', key: 'b', value: { rev: revB } },
    ])
  })

  test('should handle the update_seq option', async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value' },
      { _id: 'b', test: 'other' },
    ])

    const { result, waitForNextUpdate, rerender } = renderHook(
      (update_seq: boolean) => useAllDocs({ update_seq }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.update_seq).toBeUndefined()

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.update_seq).not.toBeUndefined()
  })
})
