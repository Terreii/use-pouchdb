import { Provider, usePouchDB } from './index'

test('should export the provider', () => {
  expect(Provider).toBeTruthy()
  expect(typeof Provider).toBe('function')
})

test('should export usePouchDB', () => {
  expect(usePouchDB).toBeTruthy()
  expect(typeof usePouchDB).toBe('function')
})
