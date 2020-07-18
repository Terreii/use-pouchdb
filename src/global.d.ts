import type { ReactNode } from 'react'

declare module 'pouchdb-errors' {
  export const MISSING_DOC: PouchDB.Core.Error
}

declare module 'pouchdb-utils' {
  export function clone<T>(arg: T): T
}

declare module 'pouchdb-selector-core' {
  export function matchesSelector<T>(
    doc: PouchDB.Core.Document<T>,
    selector: PouchDB.Find.Selector
  ): boolean
}

declare module 'react-pouchdb' {
  export function PouchDB(
    args: {
      name: string
      children: JSX.Element | ReactNode
    } & PouchDB.Core.Options
  ): React.ReactElement
  export function useDB(db: string | PouchDB.Database): PouchDB.Database
}
