import PouchDB from 'pouchdb-core'
import memory from 'pouchdb-adapter-memory'
import mapReduce from 'pouchdb-mapreduce'

import { renderHook, act } from './test-utils'
import subscription from './subscription'

PouchDB.plugin(memory)
PouchDB.plugin(mapReduce)

let myPouch: PouchDB.Database

beforeEach(() => {
  myPouch = new PouchDB('test', { adapter: 'memory' })
})

afterEach(async () => {
  await myPouch.destroy()
})

test('should have subscription methods for docs and views', () => {
  const subscriptionManager = subscription(myPouch)

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

  myPouch.changes = changes

  const subscriptionManager = subscription(myPouch)

  const unsubscribe = subscriptionManager.subscribeToDocs(
    ['test', 'userDoc', 'other'],
    (_deleted, _id, _doc) => {}
  )

  expect(changes).toHaveBeenCalledWith({
    since: 'now',
    live: true,
  })
  expect(changesObject.on).toHaveBeenCalled()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()

  expect(changesObject.cancel).toHaveBeenCalled()
})

test('should only subscribe once to document updates', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)

  myPouch.changes = changes

  const subscriptionManager = subscription(myPouch)

  const unsubscribe = subscriptionManager.subscribeToDocs(
    ['test', 'userDoc', 'other'],
    (_deleted, _id, _doc) => {}
  )
  const unsubscribe2 = subscriptionManager.subscribeToDocs(
    ['moar', 'why_couchdb_is_awesome'],
    (_deleted, _id, _doc) => {}
  )

  expect(changes).toHaveBeenCalledTimes(1)
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  const unsubscribe3 = subscriptionManager.subscribeToDocs(
    ['why_pouchdb_is_needed'],
    (_deleted, _id, _doc) => {}
  )
  expect(changes).toHaveBeenCalledTimes(1)

  unsubscribe2()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe3()
  expect(changesObject.cancel).toHaveBeenCalled()
})

test('should subscribe to view updates', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)

  myPouch.changes = changes

  const subscriptionManager = subscription(myPouch)

  const unsubscribe = subscriptionManager.subscribeToView(
    'ddoc/aView',
    _id => {}
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
})

test('should subscribe a view updates only once', () => {
  const changesObject = {
    on: jest.fn(() => changesObject),
    cancel: jest.fn(),
  }
  const changes = jest.fn(() => changesObject)

  myPouch.changes = changes

  const subscriptionManager = subscription(myPouch)

  const unsubscribe = subscriptionManager.subscribeToView(
    'ddoc/aView',
    _id => {}
  )

  expect(changes).toHaveBeenCalledTimes(1)
  expect(changesObject.cancel).not.toHaveBeenCalled()

  const unsubscribeSame = subscriptionManager.subscribeToView(
    'ddoc/aView',
    _id => {}
  )
  expect(changes).toHaveBeenCalledTimes(1)
  expect(changesObject.cancel).not.toHaveBeenCalled()

  unsubscribe()
  expect(changesObject.cancel).not.toHaveBeenCalled()

  const unsubscribeOther = subscriptionManager.subscribeToView(
    'ddoc/otherView',
    _id => {}
  )
  expect(changes).toHaveBeenCalledTimes(1)
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
})

test('should call the callback to documents with a document and to views with an id', async () => {
  const emit = (_key: any, _value?: any) => {}

  await myPouch.put({
    _id: '_design/test',
    views: {
      test: {
        map: function (doc: any) {
          emit(doc.id)
        }.toString(),
      },
    },
  })

  const docCallback = jest.fn()
  const viewCallback = jest.fn()

  const subscriptionManager = subscription(myPouch)

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

  await new Promise(resolve => {
    setTimeout(resolve, 50)
  })

  expect(docCallback).toHaveBeenCalled()
  expect(typeof docCallback.mock.calls[0]).toBe('object')
  expect(docCallback.mock.calls[0][0]).toBe('a_document')
  expect(docCallback.mock.calls[0][2]._id).toBe('a_document')
  expect(typeof docCallback.mock.calls[0]._rev).toBe('string')
  expect(docCallback.mock.calls[0].value).toBe(42)

  expect(viewCallback).toHaveBeenCalledWith('a_document')

  unsubscribeDocs()
  unsubscribeView()

  await myPouch.put({
    _id: 'a_document',
    _rev: putResult.rev,
    value: 'and the question is:',
  })

  await new Promise(resolve => {
    setTimeout(resolve, 50)
  })

  expect(docCallback).toHaveBeenCalledTimes(1)
  expect(viewCallback).toHaveBeenCalledTimes(1)
})

test('should clone the documents that are passed to document callbacks', async () => {
  const docs = []

  const subscriptionManager = subscription(myPouch)

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

  await new Promise(resolve => {
    setTimeout(resolve, 50)
  })

  docs[0].value = 43

  expect(docs.length).toBe(2)
  expect(docs[0].value).toBe(43)
  expect(docs[1].value).toBe(42)

  unsubscribe1()
  unsubscribe2()
})

test('should subscribe to all docs if null is passed to doc subscription', async () => {
  const subscriptionManager = subscription(myPouch)

  const callback = jest.fn()

  const unsubscribe = subscriptionManager.subscribeToDocs(null, callback)

  const docs = []
  for (var i = 0; i < 15; ++i) {
    docs.push({
      _id: 'doc_' + Math.random(),
      value: i,
    })
  }
  await myPouch.bulkDocs(docs)

  await new Promise(resolve => {
    setTimeout(resolve, 100)
  })

  expect(callback).toHaveBeenCalledTimes(15)

  unsubscribe()
})
