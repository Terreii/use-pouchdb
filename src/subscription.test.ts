import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import mapReduce from 'pouchdb-mapreduce'

import SubscriptionManager from './subscription'

import { sleep } from './test-utils'

PouchDB.plugin(memory)
PouchDB.plugin(mapReduce)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

const emit = (key: unknown, value?: unknown) => {
  console.log('this is only for typescript and eslint', key, value)
}

test('should have subscription methods for docs and views', () => {
  const subscriptionManager = new SubscriptionManager(myPouch)

  expect(typeof subscriptionManager).toBe('object')
  expect(typeof subscriptionManager.subscribeToDocs).toBe('function')
  expect(typeof subscriptionManager.subscribeToView).toBe('function')
})

test('should subscribe to document updates', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)
  const callback = jest.fn()

  myPouch.changes = changes

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribe = subscriptionManager.subscribeToDocs(
    ['test', 'userDoc', 'other'],
    callback
  )

  expect(changes).toHaveBeenCalledWith({
    since: 'now',
    live: true,
  })
  expect(changesObject.on).toHaveBeenCalled()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()

  expect(changesObject.cancel).toHaveBeenCalled()
  expect(callback).not.toHaveBeenCalled()
})

test('should only subscribe once to document updates', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)
  const callback1 = jest.fn()
  const callback2 = jest.fn()

  myPouch.changes = changes

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribe = subscriptionManager.subscribeToDocs(
    ['test', 'userDoc', 'other'],
    callback1
  )
  const unsubscribe2 = subscriptionManager.subscribeToDocs(
    ['moar', 'why_couchdb_is_awesome'],
    callback2
  )

  expect(changes).toHaveBeenCalledTimes(1)
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  const callback3 = jest.fn()

  const unsubscribe3 = subscriptionManager.subscribeToDocs(
    ['why_pouchdb_is_needed'],
    callback3
  )
  expect(changes).toHaveBeenCalledTimes(1)

  unsubscribe2()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe3()
  expect(changesObject.cancel).toHaveBeenCalled()

  expect(callback1).not.toHaveBeenCalled()
  expect(callback2).not.toHaveBeenCalled()
  expect(callback3).not.toHaveBeenCalled()
})

test('should handle unsubscribing during an doc update', () => {
  expect.assertions(0)
  const { changes, get } = myPouch

  const doc = {
    _id: 'test',
    _rev: '1-fb7e8b3df19087a905ab792366bd118a',
    value: 42,
  }

  let callback: (
    change: PouchDB.Core.ChangesResponseChange<{}>
  ) => void = () => {}

  ;(myPouch as unknown as { changes: unknown }).changes = () => ({
    on(_type: string, callFn: (c: unknown) => void) {
      callback = callFn
      return {
        cancel() {},
      }
    },
  })

  const subscriptionManager = new SubscriptionManager(myPouch)
  const unsubscribe = subscriptionManager.subscribeToDocs(['test'], () => {})

  let getCallback = (_doc: unknown) => {}
  ;(myPouch as unknown as { get: unknown }).get = jest.fn(() => {
    return {
      then(fn = (_doc: unknown) => {}) {
        getCallback = fn
        return { catch() {} }
      },
    }
  })

  callback({
    id: 'test',
    seq: 1,
    changes: [{ rev: doc._rev }],
    doc,
  })
  unsubscribe()
  myPouch.changes = changes
  myPouch.get = get
  try {
    getCallback(doc)
  } catch (err) {
    expect(err).toBeUndefined()
  }
})

test('should subscribe to view updates', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)
  const callback = jest.fn()

  myPouch.changes = changes

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribe = subscriptionManager.subscribeToView(
    'ddoc/aView',
    callback
  )

  expect(changes).toHaveBeenCalledWith({
    since: 'now',
    live: true,
    filter: '_view',
    view: 'ddoc/aView',
  })
  expect(changesObject.on).toHaveBeenCalled()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()

  expect(changesObject.cancel).toHaveBeenCalled()
  expect(callback).not.toHaveBeenCalled()
})

test('should subscribe a view updates only once', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)
  const callback1 = jest.fn()

  myPouch.changes = changes

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribe = subscriptionManager.subscribeToView(
    'ddoc/aView',
    callback1
  )

  expect(changes).toHaveBeenCalledTimes(1)
  expect(changesObject.cancel).not.toHaveBeenCalled()

  const callback2 = jest.fn()

  const unsubscribeSame = subscriptionManager.subscribeToView(
    'ddoc/aView',
    callback2
  )
  expect(changes).toHaveBeenCalledTimes(1)
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  const callback3 = jest.fn()

  const unsubscribeOther = subscriptionManager.subscribeToView(
    'ddoc/otherView',
    callback3
  )
  expect(changes).toHaveBeenCalledTimes(2)
  expect(changes).toHaveBeenLastCalledWith({
    since: 'now',
    live: true,
    filter: '_view',
    view: 'ddoc/otherView',
  })
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribeSame()
  expect(changesObject.cancel).toHaveBeenCalled()

  unsubscribeOther()
  expect(changesObject.cancel).toHaveBeenCalledTimes(2)

  expect(callback1).not.toHaveBeenCalled()
  expect(callback2).not.toHaveBeenCalled()
  expect(callback3).not.toHaveBeenCalled()
})

test('should call the callback to documents with a document and to views with an id', async () => {
  await myPouch.put({
    _id: '_design/test',
    views: {
      test: {
        map: function (doc: Record<string, unknown>) {
          emit(doc.id)
        }.toString(),
      },
    },
  })

  const docCallback = jest.fn()
  const viewCallback = jest.fn()

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribeDocs = subscriptionManager.subscribeToDocs(
    ['a_document'],
    docCallback
  )
  const unsubscribeView = subscriptionManager.subscribeToView(
    'test',
    viewCallback
  )

  const putResult = await myPouch.put({
    _id: 'a_document',
    value: 42,
  })

  await sleep(50)

  expect(docCallback).toHaveBeenCalled()
  expect(typeof docCallback.mock.calls[0]).toBe('object')
  expect(docCallback.mock.calls[0][1]).toBe('a_document')
  expect(docCallback.mock.calls[0][2]._id).toBe('a_document')
  expect(typeof docCallback.mock.calls[0][2]._rev).toBe('string')
  expect(docCallback.mock.calls[0][2].value).toBe(42)

  expect(viewCallback).toHaveBeenCalledWith('a_document')

  unsubscribeDocs()
  unsubscribeView()

  await myPouch.put({
    _id: 'a_document',
    _rev: putResult.rev,
    value: 'and the question is:',
  })

  await sleep(10)

  expect(docCallback).toHaveBeenCalledTimes(1)
  expect(viewCallback).toHaveBeenCalledTimes(1)
})

test('should have a unsubscribeAll method', async () => {
  await myPouch.put({
    _id: '_design/test',
    views: {
      test: {
        map: function (doc: Record<string, unknown>) {
          emit(doc.id)
        }.toString(),
      },
    },
  })

  const docCallback = jest.fn()
  const allDocCallback = jest.fn()
  const viewCallback = jest.fn()

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribeDocs = subscriptionManager.subscribeToDocs(
    ['a_document'],
    docCallback
  )
  const unsubscribeAllDocs = subscriptionManager.subscribeToDocs(
    null,
    allDocCallback
  )
  const unsubscribeView = subscriptionManager.subscribeToView(
    'test',
    viewCallback
  )

  subscriptionManager.unsubscribeAll()

  await myPouch.put({
    _id: 'a_document',
    value: 42,
  })

  await sleep(50)

  expect(docCallback).not.toHaveBeenCalled()
  expect(allDocCallback).not.toHaveBeenCalled()
  expect(viewCallback).not.toHaveBeenCalled()

  // doesn't throw
  unsubscribeDocs()
  unsubscribeAllDocs()
  unsubscribeView()
})

test('should subscribe to destroy events', async () => {
  const db = new PouchDB('other', { adapter: 'memory' })
  const subscriptionManager = new SubscriptionManager(db)

  const unsubscribeAll = subscriptionManager.unsubscribeAll
  subscriptionManager.unsubscribeAll = jest.fn((...args) =>
    unsubscribeAll.call(subscriptionManager, args)
  )

  await db.destroy()

  expect(subscriptionManager.unsubscribeAll).toHaveBeenCalled()
})

test('should clone the documents that are passed to document callbacks', async () => {
  const docs: (PouchDB.Core.IdMeta | undefined)[] = []

  const subscriptionManager = new SubscriptionManager(myPouch)

  const unsubscribe1 = subscriptionManager.subscribeToDocs(
    ['a_document'],
    (_deleted, _id, doc) => {
      docs.push(doc)
    }
  )
  const unsubscribe2 = subscriptionManager.subscribeToDocs(
    ['a_document'],
    (_deleted, _id, doc) => {
      docs.push(doc)
    }
  )

  await myPouch.put({
    _id: 'a_document',
    value: 42,
  })

  await sleep(10)
  ;(docs[0] as PouchDB.Core.IdMeta & { value: number }).value = 43

  expect(docs).toHaveLength(2)
  expect((docs[0] as PouchDB.Core.IdMeta & { value: number }).value).toBe(43)
  expect((docs[1] as PouchDB.Core.IdMeta & { value: number }).value).toBe(42)

  unsubscribe1()
  unsubscribe2()
})

test('should subscribe to all docs if null is passed to doc subscription', async () => {
  const subscriptionManager = new SubscriptionManager(myPouch)

  const callback = jest.fn()

  const unsubscribe = subscriptionManager.subscribeToDocs(null, callback)

  const docs: Array<PouchDB.Core.IdMeta & { value: number }> = []
  for (let i = 0; i < 15; ++i) {
    docs.push({
      _id: 'doc_' + Math.random(),
      value: i,
    })
  }
  await myPouch.bulkDocs(docs)

  await sleep(50)

  expect(callback).toHaveBeenCalledTimes(15)

  unsubscribe()
})
