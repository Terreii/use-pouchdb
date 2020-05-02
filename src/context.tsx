import React, {
  createContext,
  useContext as useReactContext,
  useMemo,
  useEffect,
  ReactNode,
} from 'react'

import createSubscriptionManager, {
  DocsCallback,
  ViewCallback,
} from './subscription'

export const PouchContext = createContext<{
  pouchdb: PouchDB.Database
  subscriptionManager: {
    subscribeToDocs: <T extends {}>(
      ids: string[] | null,
      callback: DocsCallback<T>
    ) => () => void
    subscribeToView: (fun: string, callback: ViewCallback) => () => void
    unsubscribeAll(): void
  }
} | null>(null)

export interface ProviderArguments {
  children: JSX.Element | ReactNode
  pouchdb: PouchDB.Database
}

export function Provider({ children, pouchdb }: ProviderArguments) {
  const context = useMemo(() => {
    const subscriptionManager = createSubscriptionManager(pouchdb)

    return {
      pouchdb,
      subscriptionManager,
    }
  }, [pouchdb])

  useEffect(
    () => () => {
      context.subscriptionManager.unsubscribeAll()
    },
    [pouchdb]
  )

  return (
    <PouchContext.Provider value={context}>{children}</PouchContext.Provider>
  )
}

export function useContext() {
  const context = useReactContext(PouchContext)

  if (process.env.NODE_ENV !== 'production' && (!context || !context.pouchdb)) {
    throw new Error(
      'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
    )
  }

  return context!
}
