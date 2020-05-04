import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'

import { renderHook, act } from './test-utils'
import useDoc from './useDoc'

PouchDB.plugin(memory)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should throw an error if there is no pouchdb context', () => {
  const { result } = renderHook(() => useDoc('test'))

  expect(result.error).toBeInstanceOf(Error)
  expect(result.error.message).toBe(
    'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
  )
})

test('should return a doc', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result, waitForNextUpdate } = renderHook(() => useDoc('test'), {
    pouchdb: myPouch,
  })

  expect(result.current.doc).toBeFalsy()
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.doc).toBeTruthy()
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.state).toBe('done')
})

test('should return a default value while first loading', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result, waitForNextUpdate } = renderHook(
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

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)
})

test('should return a default value from a function while first loading', async () => {
  await myPouch.put({ _id: 'test', value: 42, greetings: 'Hello You!' })

  const { result, waitForNextUpdate } = renderHook(
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

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)
})

test("should return a error if the doc doesn't exist", async () => {
  const { result, waitForNextUpdate } = renderHook(() => useDoc('test'), {
    pouchdb: myPouch,
  })

  expect(result.current.doc).toBeFalsy()
  expect(result.current.error).toBeNull()
  expect(result.current.state).toBe('loading')

  await waitForNextUpdate()

  expect(result.current.doc).toBeFalsy()
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.status).toBe(404)
})

test('should continue to return the default value in error-state', async () => {
  const { result, waitForNextUpdate } = renderHook(
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

  await waitForNextUpdate()

  expect(result.current.doc).toEqual({
    _id: 'test',
    _rev: '',
    other: 'doc',
  })
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.status).toBe(404)
})

test('should subscribe to updates of the document', async () => {
  const putResult = await myPouch.put({
    _id: 'test',
    value: 42,
    greetings: 'Hello You!',
  })

  const { result, waitForNextUpdate } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(
        'test'
      ),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

  act(() => {
    myPouch.put({
      _id: 'test',
      _rev: putResult.rev,
      value: 43,
      greetings: 'to you, too!',
    })
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(43)
  expect(result.current.doc.greetings).toBe('to you, too!')
})

test('should ignore updates to other docs', async () => {
  const { rev } = await myPouch.put({
    _id: 'test',
    value: 42,
  })

  const { result, waitForNextUpdate } = renderHook(
    () => useDoc<{ _id?: string; value: number | string }>('test'),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

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

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(43)
})

test('should update when a none existing document is created', async () => {
  const { result, waitForNextUpdate } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(
        'test'
      ),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate()

  expect(result.current.doc).toBeFalsy()
  expect(result.current.state).toBe('error')
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.status).toBe(404)

  act(() => {
    myPouch.put({
      _id: 'test',
      value: 42,
      greetings: 'Hello You!',
    })
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.error).toBeNull()
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)
  expect(result.current.doc.greetings).toBe('Hello You!')
})

test('should return the last doc when id did change and no initial value is passed', async () => {
  await myPouch.bulkDocs([
    { _id: 'test', value: 42, greetings: 'Hello You!' },
    { _id: 'other', value: 'changed' },
  ])

  const { result, waitForNextUpdate, rerender } = renderHook(
    id =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(id),
    {
      initialProps: 'test',
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate()

  expect(result.current.doc._id).toBe('test')

  rerender('other')

  expect(result.current.state).toBe('loading')
  expect(result.current.doc._id).toBe('test')

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('other')
  expect(result.current.doc.value).toBe('changed')
})

test('should return the initial value when id did change', async () => {
  await myPouch.bulkDocs([
    { _id: 'test', value: 42, greetings: 'Hello You!' },
    { _id: 'other', value: 'changed' },
  ])

  const { result, waitForNextUpdate, rerender } = renderHook(
    id =>
      useDoc<{ _id?: string; value: number | string }>(id, null, () => ({
        value: 'initial',
      })),
    {
      initialProps: 'test',
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate()

  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

  rerender('other')

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('other')
  expect(result.current.doc.value).toBe('changed')
})

test('should return a 404 error if the doc was deleted while it is shown', async () => {
  const putResult = await myPouch.put({
    _id: 'test',
    value: 42,
    greetings: 'Hello You!',
  })

  const { result, waitForNextUpdate } = renderHook(
    () =>
      useDoc<{ _id?: string; value: number | string; greetings: string }>(
        'test'
      ),
    {
      pouchdb: myPouch,
    }
  )

  await waitForNextUpdate()

  expect(result.current.state).toBe('done')
  expect(result.current.doc._id).toBe('test')
  expect(result.current.doc.value).toBe(42)

  act(() => {
    myPouch.remove(putResult.id, putResult.rev)
  })

  await waitForNextUpdate()

  expect(result.current.state).toBe('error')
  expect(result.current.doc).toBeNull()
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error.status).toBe(404)
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

    const { result, waitForNextUpdate, rerender } = renderHook(
      (rev: string) => useDoc<{ _id?: string; value: string }>('test', { rev }),
      {
        initialProps: resultUpdate.rev,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.doc).toEqual({
      _id: 'test',
      _rev: resultUpdate.rev,
      value: 'update',
    })

    rerender(conflictResult.rev)

    await waitForNextUpdate()

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

    const { result, waitForNextUpdate } = renderHook(
      (rev: string) => useDoc<{ _id?: string; value: string }>('test', { rev }),
      {
        initialProps: firstPutResult.rev,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

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

    const { result, waitForNextUpdate } = renderHook(
      () => useDoc<{ _id?: string; value: string }>('test', { revs: true }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.doc._revisions).toEqual({
      ids: [updateResult.rev, firstPutResult.rev].map(rev => rev.split('-')[1]),
      start: 2,
    })

    const secondUpdate = await myPouch.put({
      _id: 'test',
      _rev: updateResult.rev,
      value: 'update2',
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc._revisions).toEqual({
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

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', { revs_info: true }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.doc._revs_info).toEqual([
      { rev: updateResult.rev, status: 'available' },
      { rev: firstPutResult.rev, status: 'available' },
    ])

    const secondUpdate = await myPouch.put({
      _id: 'test',
      _rev: updateResult.rev,
      value: 'update2',
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc._revs_info).toEqual([
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

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', { conflicts: true }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    const [loosing, winning] =
      result.current.doc._rev === resultUpdate.rev
        ? [conflictResult.rev, resultUpdate.rev]
        : [resultUpdate.rev, conflictResult.rev]

    expect(result.current.doc._conflicts).toEqual([loosing])

    await myPouch.put({
      _id: 'test',
      _rev: winning,
      value: 'update2',
    })

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc._conflicts).toEqual([loosing])
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

    const { result, waitForNextUpdate, rerender } = renderHook(
      (attachments: boolean) =>
        useDoc<{ _id?: string; value: string }>('test', { attachments }),
      {
        initialProps: false,
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(typeof result.current.doc._attachments).toBe('object')
    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      length: 23,
      revpos: 1,
      stub: true,
    })

    rerender(true)

    await waitForNextUpdate()

    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })

    await myPouch.putAttachment(
      'test',
      'moar.txt',
      result.current.doc._rev,
      'aGVsbG8gd29ybGQ=',
      'text/plain'
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(result.current.doc._attachments['moar.txt']).toEqual({
      content_type: 'text/plain',
      data: 'aGVsbG8gd29ybGQ=',
      digest: 'md5-XrY7u+Ae7tCTyyK7j1rNww==',
      revpos: 2,
    })

    const doc = await myPouch.get<any>('test')
    doc.value = 'moreData'
    await myPouch.put(doc)

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc.value).toBe('moreData')
    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: 'SXMgdGhlcmUgbGlmZSBvbiBNYXJzPwo=',
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(result.current.doc._attachments['moar.txt']).toEqual({
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

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', {
          attachments: true,
          binary: true,
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.doc._attachments).toBeTruthy()
    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })

    await myPouch.putAttachment(
      'test',
      'moar.txt',
      result.current.doc._rev,
      Buffer.from('hello world'),
      'text/plain'
    )

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(result.current.doc._attachments['moar.txt']).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('hello world'),
      digest: 'md5-XrY7u+Ae7tCTyyK7j1rNww==',
      revpos: 2,
    })

    const doc = await myPouch.get<any>('test')
    doc.value = 'moreData'
    await myPouch.put(doc)

    await waitForNextUpdate()

    expect(result.current.state).toBe('loading')

    await waitForNextUpdate()

    expect(result.current.doc.value).toBe('moreData')
    expect(result.current.doc._attachments['info.txt']).toEqual({
      content_type: 'text/plain',
      data: Buffer.from('Is there life on Mars?\n'),
      digest: 'md5-knhR9rrbyHqrdPJYmv/iAg==',
      revpos: 1,
    })
    expect(result.current.doc._attachments['moar.txt']).toEqual({
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

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useDoc<{ _id?: string; value: string }>('test', {
          rev: firstPutResult.rev,
          latest: true,
        }),
      {
        pouchdb: myPouch,
      }
    )

    await waitForNextUpdate()

    expect(result.current.doc._rev).toBe(updateResult.rev)

    const secondUpdateResult = await myPouch.put({
      _id: 'test',
      _rev: updateResult.rev,
      value: 'update2',
    })

    await waitForNextUpdate()

    expect(result.current.doc._rev).toBe(secondUpdateResult.rev)
  })
})
