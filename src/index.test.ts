import { Provider, usePouch, useDoc, useQuery } from './index'

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

test('should export useQuery', () => {
  expect(useQuery).toBeTruthy()
  expect(typeof useQuery).toBe('function')
})
