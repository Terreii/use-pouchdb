import {
  Provider,
  usePouch,
  useDoc,
  useAllDocs,
  useFind,
  useView,
} from './index'

test('should export the provider', () => {
  expect(Provider).toBeTruthy()
  expect(typeof Provider).toBe('function')
})

test('should export usePouchDB', () => {
  expect(usePouch).toBeTruthy()
  expect(typeof usePouch).toBe('function')
})

test('should export useDoc', () => {
  expect(useDoc).toBeTruthy()
  expect(typeof useDoc).toBe('function')
})

test('should export useAllDocs', () => {
  expect(useAllDocs).toBeTruthy()
  expect(typeof useAllDocs).toBe('function')
})

test('should export useFind', () => {
  expect(useFind).toBeTruthy()
  expect(typeof useFind).toBe('function')
})

test('should export useView', () => {
  expect(useView).toBeTruthy()
  expect(typeof useView).toBe('function')
})
