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

describe('temporary function only views', () => {
  test("should query a view and return it's result", async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const view = (
      doc: PouchDB.Core.Document<any>,
      emit: (key: any, value?: any) => void
    ) => {
      if (doc.type === 'tester') {
        emit(doc.test, 42)
      }
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
    const putResults = await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const view = (
      doc: PouchDB.Core.Document<any>,
      emit: (key: any, value?: any) => void
    ) => {
      if (doc.type === 'tester') {
        emit(doc.test, 42)
      }
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

    let secondUpdateRev = ''
    act(() => {
      myPouch
        .put({
          _id: 'a',
          _rev: putResults[0].rev,
          test: 'newValue',
          type: 'tester',
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
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'newValue', value: 42 },
    ])

    act(() => {
      myPouch.put({
        _id: 'a',
        _rev: secondUpdateRev,
        test: 'newValue',
        type: 'otherType',
      })
    })

    await waitForNextUpdate()

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'c', key: 'Hallo!', value: 42 }])
  })

  test('should reload if a change did happen while a query did run', async () => {
    await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'checker' },
    ])

    const view = (
      doc: PouchDB.Core.Document<any>,
      emit: (key: any, value?: any) => void
    ) => {
      if (doc.type === 'tester') {
        emit(doc.test, 42)
      }
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

    act(() => {
      myPouch.bulkDocs([{ _id: 'e', test: 'Hallo!', type: 'tester' }])
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'e', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'e', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])
  })

  test('should handle the deletion of docs in the result', async () => {
    const putResults = await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'tester' },
    ])

    const view = (
      doc: PouchDB.Core.Document<any>,
      emit: (key: any, value?: any) => void
    ) => {
      if (doc.type === 'tester') {
        emit(doc.test, 42)
      }
    }

    const { result, waitForNextUpdate } = renderHook(() => useQuery(view), {
      initialProps: false,
      pouchdb: myPouch,
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'b', key: 'other', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])

    act(() => {
      myPouch.remove(putResults[0].id, putResults[0].rev)
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'b', key: 'other', value: 42 }])
  })

  describe('options', () => {
    test('should handle the include_docs option', async () => {
      const putResults = await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (include_docs: boolean) => useQuery(view, { include_docs }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        {
          doc: {
            _id: 'a',
            _rev: putResults[0].rev,
            test: 'value',
            type: 'tester',
          },
          id: 'a',
          key: 'value',
          value: 42,
        },
      ])
    })

    test('should handle the conflicts option', async () => {
      const putResults = await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
      ])

      const updateResult = await myPouch.put({
        _id: 'a',
        _rev: putResults[0].rev,
        test: 'update',
        type: 'tester',
      })

      const conflictResult = await myPouch.put(
        {
          _id: 'a',
          _rev: putResults[0].rev,
          test: 'conflict',
          type: 'tester',
        },
        { force: true }
      )

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (conflicts: boolean) =>
          useQuery(view, { include_docs: true, conflicts }),
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
          type: 'tester',
        },
        { _id: 'b', test: 'other', type: 'checker' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (attachments: boolean) =>
          useQuery(view, { include_docs: true, attachments }),
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

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (binary: boolean) =>
          useQuery(view, { include_docs: true, attachments: true, binary }),
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
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (startkey: any) => useQuery(view, { startkey }),
        {
          initialProps: 'x',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender('a')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the endkey option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (endkey: any) => useQuery(view, { endkey }),
        {
          initialProps: 'value\uffff',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender('a')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([])
    })

    test("should not query if startkey or endkey are objects or arrays and their content didn't change", async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit([doc._id, doc.test], 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        ({ startkey, endkey }: { startkey: any; endkey: any }) =>
          useQuery(view, { startkey, endkey }),
        {
          initialProps: {
            startkey: ['b'],
            endkey: ['c'],
          },
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])

      rerender({
        startkey: ['b'],
        endkey: ['c'],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        startkey: ['b'],
        endkey: [{}],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])

      rerender({
        startkey: [''],
        endkey: [{}],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'b', key: ['b', 'other'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])
    })

    test('should handle the inclusive_end option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (inclusive_end: boolean) =>
          useQuery(view, { endkey: 'x-value', inclusive_end }),
        {
          initialProps: true,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(false)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the limit option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (limit?: number) => useQuery(view, { limit }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(5)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the skip option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (skip?: number) => useQuery(view, { skip }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(5)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([])
    })

    test('should handle the descending option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (descending: boolean) => useQuery(view, { descending }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the key option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (key: any) => useQuery(view, { key }),
        {
          initialProps: 'value',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender('x-value')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the keys option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (keys: any[]) => useQuery(view, { keys }),
        {
          initialProps: ['value'],
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(['x-value', 'value'])

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test("should not query if key or keys are objects or arrays and their content didn't change", async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit([doc._id, doc.test], 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (option: { key?: any; keys?: any[] }) => useQuery(view, option),
        {
          initialProps: {
            key: ['b', 'other'],
          },
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])

      rerender({
        key: ['b', 'other'],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        key: ['a', 'value'],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
      ])

      rerender({
        keys: [
          ['a', 'value'],
          ['c', 'x-value'],
        ],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])

      rerender({
        keys: [
          ['a', 'value'],
          ['c', 'x-value'],
        ],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        keys: [
          ['a', 'value'],
          ['b', 'other'],
        ],
      })

      expect(result.current.loading).toBe(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])
    })

    test('should handle the update_seq option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
      ])

      const view = (
        doc: PouchDB.Core.Document<any>,
        emit: (key: any, value?: any) => void
      ) => {
        if (doc.type === 'tester') {
          emit(doc.test, 42)
        }
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (update_seq: boolean) => useQuery(view, { update_seq }),
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
})

describe('temporary views objects', () => {
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
    const putResults = await myPouch.bulkDocs([
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

    let secondUpdateRev = ''
    act(() => {
      myPouch
        .put({
          _id: 'a',
          _rev: putResults[0].rev,
          test: 'newValue',
          type: 'tester',
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
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'newValue', value: 42 },
    ])

    act(() => {
      myPouch.put({
        _id: 'a',
        _rev: secondUpdateRev,
        test: 'newValue',
        type: 'otherType',
      })
    })

    await waitForNextUpdate()

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'c', key: 'Hallo!', value: 42 }])
  })

  test('should reload if a change did happen while a query did run', async () => {
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

    act(() => {
      myPouch.bulkDocs([{ _id: 'e', test: 'Hallo!', type: 'tester' }])
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'e', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'e', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])
  })

  test('should handle the deletion of docs in the result', async () => {
    const putResults = await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'tester' },
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
      initialProps: false,
      pouchdb: myPouch,
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'b', key: 'other', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])

    act(() => {
      myPouch.remove(putResults[0].id, putResults[0].rev)
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'b', key: 'other', value: 42 }])
  })

  describe('options', () => {
    test('should handle the reduce option', async () => {
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
        reduce: '_count',
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (reduce: boolean) => useQuery(view, { reduce }),
        {
          initialProps: true,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([{ key: null, value: 1 }])

      rerender(false)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the include_docs option', async () => {
      const putResults = await myPouch.bulkDocs([
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (include_docs: boolean) => useQuery(view, { include_docs }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        {
          doc: {
            _id: 'a',
            _rev: putResults[0].rev,
            test: 'value',
            type: 'tester',
          },
          id: 'a',
          key: 'value',
          value: 42,
        },
      ])
    })

    test('should handle the conflicts option', async () => {
      const putResults = await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
      ])

      const updateResult = await myPouch.put({
        _id: 'a',
        _rev: putResults[0].rev,
        test: 'update',
        type: 'tester',
      })

      const conflictResult = await myPouch.put(
        {
          _id: 'a',
          _rev: putResults[0].rev,
          test: 'conflict',
          type: 'tester',
        },
        { force: true }
      )

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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (conflicts: boolean) =>
          useQuery(view, { include_docs: true, conflicts }),
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
          type: 'tester',
        },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (attachments: boolean) =>
          useQuery(view, { include_docs: true, attachments }),
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (binary: boolean) =>
          useQuery(view, { include_docs: true, attachments: true, binary }),
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
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (startkey: any) => useQuery(view, { startkey }),
        {
          initialProps: 'x',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender('a')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the endkey option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (endkey: any) => useQuery(view, { endkey }),
        {
          initialProps: 'value\uffff',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender('a')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([])
    })

    test("should not query if startkey or endkey are objects or arrays and their content didn't change", async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = {
        map: (
          doc: PouchDB.Core.Document<any>,
          emit: (key: any, value?: any) => void
        ) => {
          if (doc.type === 'tester') {
            emit([doc._id, doc.test], 42)
          }
        },
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        ({ startkey, endkey }: { startkey: any; endkey: any }) =>
          useQuery(view, { startkey, endkey }),
        {
          initialProps: {
            startkey: ['b'],
            endkey: ['c'],
          },
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])

      rerender({
        startkey: ['b'],
        endkey: ['c'],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        startkey: ['b'],
        endkey: [{}],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])

      rerender({
        startkey: [''],
        endkey: [{}],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'b', key: ['b', 'other'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])
    })

    test('should handle the inclusive_end option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (inclusive_end: boolean) =>
          useQuery(view, { endkey: 'x-value', inclusive_end }),
        {
          initialProps: true,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(false)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the limit option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (limit?: number) => useQuery(view, { limit }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(5)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the skip option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (skip?: number) => useQuery(view, { skip }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(5)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([])
    })

    test('should handle the descending option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (descending: boolean) => useQuery(view, { descending }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the key option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (key: any) => useQuery(view, { key }),
        {
          initialProps: 'value',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender('x-value')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the keys option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (keys: any[]) => useQuery(view, { keys }),
        {
          initialProps: ['value'],
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(['x-value', 'value'])

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the group option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'value', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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
        reduce: '_count',
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (group: boolean) => useQuery(view, { group }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([{ key: null, value: 3 }])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { key: 'value', value: 2 },
        { key: 'x-value', value: 1 },
      ])
    })

    test('should handle the group option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'value', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = {
        map: (
          doc: PouchDB.Core.Document<any>,
          emit: (key: any, value?: any) => void
        ) => {
          if (doc.type === 'tester') {
            emit([13, doc.test], 42)
          }
        },
        reduce: '_count',
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (group_level: number) => useQuery(view, { group_level }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([{ key: [13], value: 3 }])

      rerender(2)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { key: [13, 'value'], value: 2 },
        { key: [13, 'x-value'], value: 1 },
      ])
    })

    test("should not query if key or keys are objects or arrays and their content didn't change", async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const view = {
        map: (
          doc: PouchDB.Core.Document<any>,
          emit: (key: any, value?: any) => void
        ) => {
          if (doc.type === 'tester') {
            emit([doc._id, doc.test], 42)
          }
        },
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (option: { key?: any; keys?: any[] }) => useQuery(view, option),
        {
          initialProps: {
            key: ['b', 'other'],
          },
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])

      rerender({
        key: ['b', 'other'],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        key: ['a', 'value'],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
      ])

      rerender({
        keys: [
          ['a', 'value'],
          ['c', 'x-value'],
        ],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])

      rerender({
        keys: [
          ['a', 'value'],
          ['c', 'x-value'],
        ],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        keys: [
          ['a', 'value'],
          ['b', 'other'],
        ],
      })

      expect(result.current.loading).toBe(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])
    })

    test('should handle the update_seq option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
      ])

      const view = {
        map: (
          doc: PouchDB.Core.Document<any>,
          emit: (key: any, value?: any) => void
        ) => {
          if (doc.type === 'tester') {
            emit([doc._id, doc.test], 42)
          }
        },
      }

      const { result, waitForNextUpdate, rerender } = renderHook(
        (update_seq: boolean) => useQuery(view, { update_seq }),
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
    const putResults = await myPouch.bulkDocs([
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

    let secondUpdateRev = ''
    act(() => {
      myPouch
        .put({
          _id: 'a',
          _rev: putResults[0].rev,
          test: 'newValue',
          type: 'tester',
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
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'newValue', value: 42 },
    ])

    act(() => {
      myPouch.put({
        _id: 'a',
        _rev: secondUpdateRev,
        test: 'newValue',
        type: 'otherType',
      })
    })

    await waitForNextUpdate()

    expect(result.current.loading).toBeTruthy()

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'c', key: 'Hallo!', value: 42 }])
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

    await waitForNextUpdate()

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

  test('should reload if a change did happen while a query did run', async () => {
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

    expect(result.current.state).toBe('loading')
    expect(result.current.rows).toEqual([{ id: 'a', key: 'value', value: 42 }])

    act(() => {
      myPouch.bulkDocs([{ _id: 'e', test: 'Hallo!', type: 'tester' }])
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'c', key: 'Hallo!', value: 42 },
      { id: 'e', key: 'Hallo!', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])
  })

  test('should handle the deletion of docs in the result', async () => {
    const putResults = await myPouch.bulkDocs([
      { _id: 'a', test: 'value', type: 'tester' },
      { _id: 'b', test: 'other', type: 'tester' },
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
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([
      { id: 'b', key: 'other', value: 42 },
      { id: 'a', key: 'value', value: 42 },
    ])

    act(() => {
      myPouch.remove(putResults[0].id, putResults[0].rev)
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.state).toBe('done')
    expect(result.current.rows).toEqual([{ id: 'b', key: 'other', value: 42 }])
  })

  describe('options', () => {
    test('should handle the reduce option', async () => {
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
            reduce: '_count',
          },
        },
      }

      await myPouch.put(ddoc)

      const { result, waitForNextUpdate, rerender } = renderHook(
        (reduce: boolean) => useQuery('ddoc/test', { reduce }),
        {
          initialProps: true,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([{ key: null, value: 1 }])

      rerender(false)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the include_docs option', async () => {
      const putResults = await myPouch.bulkDocs([
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (include_docs: boolean) => useQuery('ddoc/test', { include_docs }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        {
          doc: {
            _id: 'a',
            _rev: putResults[0].rev,
            test: 'value',
            type: 'tester',
          },
          id: 'a',
          key: 'value',
          value: 42,
        },
      ])
    })

    test('should handle the conflicts option', async () => {
      const putResults = await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
      ])

      const updateResult = await myPouch.put({
        _id: 'a',
        _rev: putResults[0].rev,
        test: 'update',
        type: 'tester',
      })

      const conflictResult = await myPouch.put(
        {
          _id: 'a',
          _rev: putResults[0].rev,
          test: 'conflict',
          type: 'tester',
        },
        { force: true }
      )

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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (conflicts: boolean) =>
          useQuery('ddoc/test', { include_docs: true, conflicts }),
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
          type: 'tester',
        },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (attachments: boolean) =>
          useQuery('ddoc/test', { include_docs: true, attachments }),
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (binary: boolean) =>
          useQuery('ddoc/test', {
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
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (startkey: any) => useQuery('ddoc/test', { startkey }),
        {
          initialProps: 'x',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender('a')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the endkey option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (endkey: any) => useQuery('ddoc/test', { endkey }),
        {
          initialProps: 'value\uffff',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender('a')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([])
    })

    test("should not query if startkey or endkey are objects or arrays and their content didn't change", async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const ddoc = {
        _id: '_design/ddoc',
        views: {
          test: {
            map: function (doc: PouchDB.Core.Document<any>) {
              if (doc.type === 'tester') {
                emit([doc._id, doc.test], 42)
              }
            }.toString(),
          },
        },
      }

      await myPouch.put(ddoc)

      const { result, waitForNextUpdate, rerender } = renderHook(
        ({ startkey, endkey }: { startkey: any; endkey: any }) =>
          useQuery('ddoc/test', { startkey, endkey }),
        {
          initialProps: {
            startkey: ['b'],
            endkey: ['c'],
          },
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])

      rerender({
        startkey: ['b'],
        endkey: ['c'],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        startkey: ['b'],
        endkey: [{}],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])

      rerender({
        startkey: [''],
        endkey: [{}],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'b', key: ['b', 'other'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])
    })

    test('should handle the inclusive_end option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (inclusive_end: boolean) =>
          useQuery('ddoc/test', { endkey: 'x-value', inclusive_end }),
        {
          initialProps: true,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(false)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the limit option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (limit?: number) => useQuery('ddoc/test', { limit }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(5)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the skip option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (skip?: number) => useQuery('ddoc/test', { skip }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(5)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([])
    })

    test('should handle the descending option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (descending: boolean) => useQuery('ddoc/test', { descending }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
        { id: 'c', key: 'x-value', value: 42 },
      ])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the key option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'checker' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (key: any) => useQuery('ddoc/test', { key }),
        {
          initialProps: 'value',
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender('x-value')

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
      ])
    })

    test('should handle the keys option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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

      const { result, waitForNextUpdate, rerender } = renderHook(
        (keys: any[]) => useQuery('ddoc/test', { keys }),
        {
          initialProps: ['value'],
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: 'value', value: 42 },
      ])

      rerender(['x-value', 'value'])

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'c', key: 'x-value', value: 42 },
        { id: 'a', key: 'value', value: 42 },
      ])
    })

    test('should handle the group option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'value', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
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
            reduce: '_count',
          },
        },
      }

      await myPouch.put(ddoc)

      const { result, waitForNextUpdate, rerender } = renderHook(
        (group: boolean) => useQuery('ddoc/test', { group }),
        {
          initialProps: false,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([{ key: null, value: 3 }])

      rerender(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { key: 'value', value: 2 },
        { key: 'x-value', value: 1 },
      ])
    })

    test('should handle the group option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'value', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const ddoc = {
        _id: '_design/ddoc',
        views: {
          test: {
            map: function (doc: PouchDB.Core.Document<any>) {
              if (doc.type === 'tester') {
                emit([13, doc.test], 42)
              }
            }.toString(),
            reduce: '_count',
          },
        },
      }

      await myPouch.put(ddoc)

      const { result, waitForNextUpdate, rerender } = renderHook(
        (group_level: number) => useQuery('ddoc/test', { group_level }),
        {
          initialProps: 1,
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([{ key: [13], value: 3 }])

      rerender(2)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { key: [13, 'value'], value: 2 },
        { key: [13, 'x-value'], value: 1 },
      ])
    })

    test("should not query if key or keys are objects or arrays and their content didn't change", async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
        { _id: 'c', test: 'x-value', type: 'tester' },
      ])

      const ddoc = {
        _id: '_design/ddoc',
        views: {
          test: {
            map: function (doc: PouchDB.Core.Document<any>) {
              if (doc.type === 'tester') {
                emit([doc._id, doc.test], 42)
              }
            }.toString(),
          },
        },
      }

      await myPouch.put(ddoc)

      const { result, waitForNextUpdate, rerender } = renderHook(
        (option: { key?: any; keys?: any[] }) => useQuery('ddoc/test', option),
        {
          initialProps: {
            key: ['b', 'other'],
          },
          pouchdb: myPouch,
        }
      )

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])

      rerender({
        key: ['b', 'other'],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        key: ['a', 'value'],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
      ])

      rerender({
        keys: [
          ['a', 'value'],
          ['c', 'x-value'],
        ],
      })

      expect(result.current.loading).toBe(true)
      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'c', key: ['c', 'x-value'], value: 42 },
      ])

      rerender({
        keys: [
          ['a', 'value'],
          ['c', 'x-value'],
        ],
      })

      expect(result.current.loading).toBe(false)

      rerender({
        keys: [
          ['a', 'value'],
          ['b', 'other'],
        ],
      })

      expect(result.current.loading).toBe(true)

      await waitForNextUpdate()

      expect(result.current.state).toBe('done')
      expect(result.current.rows).toEqual([
        { id: 'a', key: ['a', 'value'], value: 42 },
        { id: 'b', key: ['b', 'other'], value: 42 },
      ])
    })

    test('should handle the update_seq option', async () => {
      await myPouch.bulkDocs([
        { _id: 'a', test: 'value', type: 'tester' },
        { _id: 'b', test: 'other', type: 'tester' },
      ])

      const ddoc = {
        _id: '_design/ddoc',
        views: {
          test: {
            map: function (doc: PouchDB.Core.Document<any>) {
              if (doc.type === 'tester') {
                emit([doc._id, doc.test], 42)
              }
            }.toString(),
          },
        },
      }

      await myPouch.put(ddoc)

      const { result, waitForNextUpdate, rerender } = renderHook(
        (update_seq: boolean) => useQuery('ddoc/test', { update_seq }),
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
})
