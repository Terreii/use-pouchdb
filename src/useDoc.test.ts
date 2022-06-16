import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import {
  renderHook,
  renderHookWithMultiDbContext,
  act,
  waitForNextUpdate,
  DocWithAttachment,
} from './test-utils'
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

  const { result } = renderHook(() => useDoc('test'), {
    pouchdb: myPouch,
  })

  expect(result.current.doc).toBeFalsy()
  expect(result.current.error).toBeNull()
  expect(result.current.loading).toBeTruthy()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate(result)

  expect(result.current.doc).toBeTruthy()
  expect(result.current.error).toBeNull()
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.loading).toBeFalsy()
  expect(result.current.state).toBe('done')
})

test('should return a default value while first loading', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string }>('test', null, {
        value: 'doc',
      }),
    {
      pouchdb: myPouch,
    }
  )

  expect(result.current.doc).toEqual({
    _id: 'test',
    _rev: '',
    value: 'doc',
  })
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)
})

test('should return a default value from a function while first loading', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string }>('test', null, () => ({
        value: 'doc',
      })),
    {
      pouchdb: myPouch,
    }
  )

  expect(result.current.doc).toEqual({
    _id: 'test',
    _rev: '',
    value: 'doc',
  })
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)
})

test("should return a error if the doc doesn't exist", async () => {
  const { result } = renderHook(() => useDoc('test'), {
    pouchdb: myPouch,
  })

  expect(result.current.doc).toBeFalsy()
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate(result)

  expect(result.current.doc).toBeFalsy()
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error?.status).toBe(404)
})

test('should continue to return the default value in error-state', async () => {
  const { result } = renderHook(
    () => useDoc('test', null, () => ({ other: 'doc' })),
    {
      pouchdb: myPouch,
    }
  )

  expect(result.current.doc).toEqual({
    _id: 'test',
    _rev: '',
    other: 'doc',
  })
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate(result)

  expect(result.current.doc).toEqual({
    _id: 'test',
    _rev: '',
    other: 'doc',
  })
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error?.status).toBe(404)
})

test('should subscribe to updates of the document', async () => {
  const putResult = await myPouch.put({
    _id: 'test',
    value: 42,
    greetings: 'Hello You!',
  })

  const { result } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(
        'test'
      ),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)

  act(() => {
    myPouch.put({
      _id: 'test',
      _rev: putResult.rev,
      value: 43,
      greetings: 'to you, too!',
    })
  })

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(43)
  expect(result.current.doc?.greetings).toBe('to you, too!')
})

test('should ignore updates to other docs', async () => {
  const { rev } = await myPouch.put({
    _id: 'test',
    value: 42,
  })

  const { result } = renderHook(
    () => useDoc<{ _id?: string; value: number | string }>('test'),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)

  act(() => {
    myPouch.bulkDocs([
      {
        _id: 'test',
        _rev: rev,
        value: 43,
      },
      {
        _id: 'other',
        value: 128,
      },
    ])
  })

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(43)
})

test('should update when a none existing document is created', async () => {
  const { result } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(
        'test'
      ),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  expect(result.current.doc).toBeFalsy()
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error?.status).toBe(404)

  act(() => {
    myPouch.put({
      _id: 'test',
      value: 42,
      greetings: 'Hello You!',
    })
  })

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)
  expect(result.current.doc?.greetings).toBe('Hello You!')
})

test('should return the last doc when id did change and no initial value is passed', async () => {
  await myPouch.bulkDocs([
    { _id: 'test', value: 42, greetings: 'Hello You!' },
    { _id: 'other', value: 'changed' },
  ])

  const { result, rerender } = renderHook(
    id =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(id),
    {
      initialProps: 'test',
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  expect(result.current.doc?._id).toBe('test')

  rerender('other')

  expect(result.current.state).toBe('loading')
  expect(result.current.doc?._id).toBe('test')

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('other')
  expect(result.current.doc?.value).toBe('changed')
})

test('should return the initial value when id did change', async () => {
  await myPouch.bulkDocs([
    { _id: 'test', value: 42, greetings: 'Hello You!' },
    { _id: 'other', value: 'changed' },
  ])

  const { result, rerender } = renderHook(
    id =>
      useDoc<{ _id?: string; value: number | string }>(id, null, () => ({
        value: 'initial',
      })),
    {
      initialProps: 'test',
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)

  rerender('other')

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('other')
  expect(result.current.doc?.value).toBe('changed')
})

test('should return a 404 error if the doc was deleted while it is shown', async () => {
  const putResult = await myPouch.put({
    _id: 'test',
    value: 42,
    greetings: 'Hello You!',
  })

  const { result } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(
        'test'
      ),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(42)

  act(() => {
    myPouch.remove(putResult.id, putResult.rev)
  })

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('error')
  expect(result.current.doc).toBeNull()
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error?.status).toBe(404)
})

test('should return the new winning rev doc was deleted while it is shown and has a conflicting version', async () => {
  const putResult = await myPouch.put({
    _id: 'test',
    value: 42,
  })

  const resultUpdate = await myPouch.put({
    _id: 'test',
    _rev: putResult.rev,
    value: 'update',
  })

  const conflictResult = await myPouch.put(
    {
      _id: 'test',
      _rev: putResult.rev,
      value: 'conflict',
    },
    { force: true }
  )

  const { result } = renderHook(
    () => useDoc<{ _id?: string; value: number | string }>('test'),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate(result)

  const [winningRev, conflictRev, winningValue, conflictValue] =
    result.current.doc?._rev === resultUpdate.rev
      ? [resultUpdate.rev, conflictResult.rev, 'update', 'conflict']
      : [conflictResult.rev, resultUpdate.rev, 'conflict', 'update']

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._id).toBe('test')
  expect(result.current.doc?.value).toBe(winningValue)

  act(() => {
    myPouch.remove(putResult.id, winningRev)
  })

  await waitForNextUpdate(result)

  expect(result.current.state).toBe('done')
  expect(result.current.doc?._rev).toBe(conflictRev)
  expect(result.current.doc?.value).toBe(conflictValue)
})

describe('pouchdb get options', () => {
  test('should returns a specific rev if rev is set', async () => {
    const firstPutResult = await myPouch.put({
      _id: 'test',
      value: 'first',
    })

    const resultUpdate = await myPouch.put({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'update',
    })

    const conflictResult = await myPouch.put(
      {
        _id: 'test',
        _rev: firstPutResult.rev,
        value: 'conflict',
      },
      { force: true }
    )

    const { result, rerender } = renderHook(
      (rev: string) => useDoc<{ _id?: string; value: string }>('test', { rev }),
      {
        initialProps: resultUpdate.rev,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: resultUpdate.rev,
      value: 'update',
    })

    rerender(conflictResult.rev)

    await waitForNextUpdate(result)

    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: conflictResult.rev,
      value: 'conflict',
    })
  })

  test('should not update if a change did happen and rev is set', async () => {
    const firstPutResult = await myPouch.put({
      _id: 'test',
      value: 'first',
    })

    const { result } = renderHook(
      (rev: string) => useDoc<{ _id?: string; value: string }>('test', { rev }),
      {
        initialProps: firstPutResult.rev,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    await myPouch.put({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'update',
    })

    await new Promise(resolve => {
      setTimeout(resolve, 10)
    })

    expect(result.current.state).toBe('done')
    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'first',
    })
  })

  test('should include revision history if revs is set', async () => {
    const firstPutResult = await myPouch.put({
      _id: 'test',
      value: 'first',
    })

    const updateResult = await myPouch.put({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'update',
    })

    const { result } = renderHook(
      () => useDoc<{ _id?: string; value: string }>('test', { revs: true }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.doc?._revisions).toEqual({
      ids: [updateResult.rev, firstPutResult.rev].map(rev => rev.split('-')[1]),
      start: 2,
    })

    const secondUpdate = await myPouch.put({
      _id: 'test',
      _rev: updateResult.rev,
      value: 'update2',
    })

    await waitForNextUpdate(result)

    expect(result.current.doc?._revisions).toEqual({
      ids: [secondUpdate.rev, updateResult.rev, firstPutResult.rev].map(
        rev => rev.split('-')[1]
      ),
      start: 3,
    })
  })

  test('should include revs_info if revs_info is set to true', async () => {
    const firstPutResult = await myPouch.put({
      _id: 'test',
      value: 'first',
    })

    const updateResult = await myPouch.put({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'update',
    })

    const { result } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', { revs_info: true }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.doc?._revs_info).toEqual([
      { rev: updateResult.rev, status: 'available' },
      { rev: firstPutResult.rev, status: 'available' },
    ])

    const secondUpdate = await myPouch.put({
      _id: 'test',
      _rev: updateResult.rev,
      value: 'update2',
    })

    await waitForNextUpdate(result)

    expect(result.current.doc?._revs_info).toEqual([
      { rev: secondUpdate.rev, status: 'available' },
      { rev: updateResult.rev, status: 'available' },
      { rev: firstPutResult.rev, status: 'available' },
    ])
  })

  test('should return a list of conflicts if conflicts is set to true', async () => {
    const firstPutResult = await myPouch.put({
      _id: 'test',
      value: 'first',
    })

    const resultUpdate = await myPouch.put({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'update',
    })

    const conflictResult = await myPouch.put(
      {
        _id: 'test',
        _rev: firstPutResult.rev,
        value: 'conflict',
      },
      { force: true }
    )

    const { result } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', { conflicts: true }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    const [loosing, winning] =
      result.current.doc?._rev === resultUpdate.rev
        ? [conflictResult.rev, resultUpdate.rev]
        : [resultUpdate.rev, conflictResult.rev]

    expect(result.current.doc?._conflicts).toEqual([loosing])

    await myPouch.put({
      _id: 'test',
      _rev: winning,
      value: 'update2',
    })

    await waitForNextUpdate(result)

    expect(result.current.doc?._conflicts).toEqual([loosing])
  })

  test('should include attachments if attachments is set to true', async () => {
    await myPouch.put({
      _id: 'test',
      _attachments: {
        'info.txt': {
          content_type: 'text/plain',
          data: Buffer.from('Is there life on Mars?\n'),
        },
      },
      value: 'first',
    })

    const { result, rerender } = renderHook(
      (attachments: boolean) =>
        useDoc<{ _id?: string; value: string }>('test', { attachments }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(typeof result.current.doc?._attachments).toBe('object')
    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      length: 23,
      revpos: 1,
      stub: true,
    })

    rerender(true)

    await waitForNextUpdate(result)

    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })

    await myPouch.putAttachment(
      'test',
      'moar.txt',
      result.current.doc?._rev ?? 'fail',
      'aGVsbG8gd29ybGQ=',
      'text/plain'
    )

    await waitForNextUpdate(result)

    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(
      (result.current.doc as DocWithAttachment)._attachments['moar.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: 'aGVsbG8gd29ybGQ=',
      digest: 'md5-XrY7u+Ae7tCTyyK7j1rNww==',
      revpos: 2,
    })

    const doc = await myPouch.get<Record<string, unknown>>('test')
    doc.value = 'moreData'
    await myPouch.put(doc)

    await waitForNextUpdate(result)

    expect(result.current.doc?.value).toBe('moreData')
    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(
      (result.current.doc as DocWithAttachment)._attachments['moar.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: 'aGVsbG8gd29ybGQ=',
      digest: 'md5-XrY7u+Ae7tCTyyK7j1rNww==',
      revpos: 2,
    })
  })

  test('should include attachments as buffer/blob if attachments and binary are true', async () => {
    await myPouch.put({
      _id: 'test',
      _attachments: {
        'info.txt': {
          content_type: 'text/plain',
          data: Buffer.from('Is there life on Mars?\n'),
        },
      },
      value: 'first',
    })

    const { result } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', {
          attachments: true,
          binary: true,
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.doc?._attachments).toBeTruthy()
    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })

    await myPouch.putAttachment(
      'test',
      'moar.txt',
      result.current.doc?._rev ?? 'fail',
      Buffer.from('hello world'),
      'text/plain'
    )

    await waitForNextUpdate(result)

    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(
      (result.current.doc as DocWithAttachment)._attachments['moar.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('hello world'),
      digest: 'md5-XrY7u+Ae7tCTyyK7j1rNww==',
      revpos: 2,
    })

    const doc = await myPouch.get<Record<string, unknown>>('test')
    doc.value = 'moreData'
    await myPouch.put(doc)

    await waitForNextUpdate(result)

    expect(result.current.doc?.value).toBe('moreData')
    expect(
      (result.current.doc as DocWithAttachment)._attachments['info.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(
      (result.current.doc as DocWithAttachment)._attachments['moar.txt']
    ).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('hello world'),
      digest: 'md5-XrY7u+Ae7tCTyyK7j1rNww==',
      revpos: 2,
    })
  })

  test('should return the latest leaf revision if latest is set to true', async () => {
    const firstPutResult = await myPouch.put({
      _id: 'test',
      value: 'first',
    })

    const updateResult = await myPouch.put({
      _id: 'test',
      _rev: firstPutResult.rev,
      value: 'update',
    })

    const { result } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', {
          rev: firstPutResult.rev,
          latest: true,
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate(result)

    expect(result.current.doc?._rev).toBe(updateResult.rev)

    const secondUpdateResult = await myPouch.put({
      _id: 'test',
      _rev: updateResult.rev,
      value: 'update2',
    })

    await waitForNextUpdate(result)

    expect(result.current.doc?._rev).toBe(secondUpdateResult.rev)
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
      (name?: string) => useDoc('test', { db: name }),
      {
        initialProps: undefined,
        main: myPouch,
        other: other,
      }
    )

    await waitForNextUpdate(result)

    // No db selection
    expect(result.current.loading).toBeFalsy()
    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: expect.anything(),
      value: 'myPouch',
    })

    // selecting a database that is not the default
    rerender('other')
    expect(result.current.loading).toBeTruthy()
    await waitForNextUpdate(result)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: expect.anything(),
      value: 'other',
    })

    // selecting the default db by it's name
    rerender('main')
    expect(result.current.loading).toBeTruthy()
    await waitForNextUpdate(result)

    expect(result.current.loading).toBeFalsy()
    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: expect.anything(),
      value: 'myPouch',
    })

    // reset to other db
    rerender('other')
    expect(result.current.loading).toBeTruthy()
    await waitForNextUpdate(result)

    // selecting by special _default key
    rerender('_default')
    await waitForNextUpdate(result)

    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: expect.anything(),
      value: 'myPouch',
    })

    await other.destroy()
  })
})
