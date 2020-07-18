import { renderHook } from '@testing-library/react-hooks'
import PouchDBUsed from 'pouchdb'
import React from 'react'
import memory from 'pouchdb-adapter-memory'
import { PouchDB } from 'react-pouchdb'

import { useContext } from './context'
import ReactPouchContextBridge from './react-pouch-context-bridge'

PouchDBUsed.plugin(memory)

test("should get the database from react-pouchdb's context", () => {
  const { result } = renderHook(() => useContext(), {
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <PouchDB name="test_pouch_a" adapter="memory">
          <ReactPouchContextBridge default="test_pouch_a">
            {children}
          </ReactPouchContextBridge>
        </PouchDB>
      )
    },
  })

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_a')
})

test('should get multiple databases from the context of react-pouchdb', () => {
  const { result, rerender } = renderHook((name: string) => useContext(name), {
    initialProps: '_default',
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <PouchDB name="test_pouch_a" adapter="memory">
          <PouchDB name="test_pouch_b" adapter="memory">
            <ReactPouchContextBridge
              default="test_pouch_a"
              names={['test_pouch_a', 'test_pouch_b']}
            >
              {children}
            </ReactPouchContextBridge>
          </PouchDB>
        </PouchDB>
      )
    },
  })

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_a')

  rerender('test_pouch_b')

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_b')

  rerender('test_pouch_a')

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_a')
})

test('should add the default if it is not in the names list', () => {
  const { result, rerender } = renderHook((name: string) => useContext(name), {
    initialProps: '_default',
    wrapper: function Wrapper({ children }: { children: React.ReactChildren }) {
      return (
        <PouchDB name="test_pouch_a" adapter="memory">
          <PouchDB name="test_pouch_b" adapter="memory">
            <ReactPouchContextBridge
              default="test_pouch_a"
              names={['test_pouch_b']}
            >
              {children}
            </ReactPouchContextBridge>
          </PouchDB>
        </PouchDB>
      )
    },
  })

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_a')

  rerender('test_pouch_b')

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_b')

  rerender('test_pouch_a')

  expect(result.current.pouchdb).toBeInstanceOf(PouchDBUsed)
  expect(result.current.pouchdb.name).toBe('test_pouch_a')
})
