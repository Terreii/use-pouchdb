declare module 'pouchdb-errors' {
  export const MISSING_DOC: PouchDB.Core.Error
}

declare module 'pouchdb-utils' {
  export function clone<T>(arg: T): T
}

declare module 'pouchdb-selector-core' {
  export function matchesSelector<T extends {}>(
    doc: PouchDB.Core.Document<T>,
    selector: PouchDB.Find.Selector
  ): boolean
}
