declare module 'pouchdb-errors' {
  export const MISSING_DOC: PouchDB.Core.Error
}

declare module 'pouchdb-utils' {
  export function clone<T>(arg: T): T
}
