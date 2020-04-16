import React, { createContext, ReactNode } from 'react'

export const PouchContext = createContext<PouchDB.Database | null>(null)

export interface ProviderArguments {
  children: JSX.Element | ReactNode
  pouchdb: PouchDB.Database
}

export function Provider({ children, pouchdb }: ProviderArguments) {
  return (
    <PouchContext.Provider value={pouchdb}>{children}</PouchContext.Provider>
  )
}
