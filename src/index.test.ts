import { Provider, usePouchDB, useQuery } from './index'

test('should export the provider', () => {
  expect(Provider).toBeTruthy()
  expect(typeof Provider).toBe('function')
})

test('should export usePouchDB', () => {
  expect(usePouchDB).toBeTruthy()
  expect(typeof usePouchDB).toBe('function')
})

test('should export useQuery', () => {
  expect(useQuery).toBeTruthy()
  expect(typeof useQuery).toBe('function')
})
