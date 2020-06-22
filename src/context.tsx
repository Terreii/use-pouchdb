import React, {
  createContext,
  useContext as useReactContext,
  useMemo,
  useEffect,
  ReactNode,
} from 'react'

import SubscriptionManager from './subscription'

export interface PouchContextObject {
  pouchdb: PouchDB.Database
  subscriptionManager: SubscriptionManager
}

const PouchContext = createContext<{ [key: string]: PouchContextObject }>({})

/**
 * Provide access to a database.
 */
export interface ProviderArguments {
  children: JSX.Element | ReactNode
  pouchdb: PouchDB.Database
  name?: string
}

/**
 * Provide access to multiple databases at once.
 */
export interface MultiDBProviderArguments {
  children: JSX.Element | ReactNode
  databases: { [key: string]: PouchDB.Database }
  default: string
}

/**
 * Create a context to provide access to PouchDB databases.
 * All hooks of usePouchDB will use this context.
 * @param args React arguments.
 */
export function Provider(
  args: ProviderArguments | MultiDBProviderArguments
): React.ReactElement {
  const children = args.children
  const { pouchdb, name: nameArg } = args as ProviderArguments
  const name = nameArg || pouchdb.name

  const contextObject = useMemo(() => {
    const subscriptionManager = new SubscriptionManager(pouchdb)

    return {
      pouchdb,
      subscriptionManager,
    }
  }, [pouchdb])

  useEffect(() => {
    const listener = () => {
      contextObject.subscriptionManager.unsubscribeAll()
    }
    pouchdb.once('destroyed', listener)
    return () => {
      pouchdb.removeListener('destroyed', listener)
      contextObject.subscriptionManager.unsubscribeAll()
    }
  }, [pouchdb, contextObject.subscriptionManager])

  const parentContext = useReactContext(PouchContext)

  const context = useMemo(() => {
    return {
      ...parentContext,
      default: contextObject,
      [name]: contextObject,
    }
  }, [contextObject, name, parentContext])

  return (
    <PouchContext.Provider value={context}>{children}</PouchContext.Provider>
  )
}

/**
 * Provides access to the Database & SubscriptionManager pair in the usePouchDB-Context.
 * @param name Name of the Database or its overwritten name. Defaults to "default".
 */
export function useContext(name: string = 'default'): PouchContextObject {
  const context = useReactContext(PouchContext)

  if (context.default == null && Object.keys(context).length === 0) {
    throw new Error(
      'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
    )
  }

  if (!(name in context)) {
    throw new Error(`could not find a PouchDB database with name of "${name}"`)
  }

  return context[name]
}
