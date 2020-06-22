import React, {
  createContext,
  useContext as useReactContext,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
} from 'react'

import SubscriptionManager from './subscription'

export interface PouchContextObject {
  pouchdb: PouchDB.Database
  subscriptionManager: SubscriptionManager
}

type ContextObject = { [key: string]: PouchContextObject }

const PouchContext = createContext<ContextObject>({})

/**
 * Provide access to a database.
 */
export interface SingleDbProviderArguments {
  children: JSX.Element | ReactNode
  pouchdb: PouchDB.Database
  name?: string
}

/**
 * Provide access to multiple databases at once.
 */
export interface MultiDbProviderArguments {
  children: JSX.Element | ReactNode
  databases: { [key: string]: PouchDB.Database }
  default: string
}

export type ProviderArguments =
  | SingleDbProviderArguments
  | MultiDbProviderArguments

/**
 * Create a context to provide access to PouchDB databases.
 * All hooks of usePouchDB will use this context.
 * @param args React arguments.
 */
export function Provider(args: ProviderArguments): React.ReactElement {
  const { pouchdb, name } = args as SingleDbProviderArguments
  const {
    databases: dbsArg,
    default: defaultArg,
  } = args as MultiDbProviderArguments

  // collection of databases added in this Provider
  let databases: { [key: string]: PouchDB.Database }
  // key of the default database
  let defaultKey: string

  // normalize the two argument types into one
  if (dbsArg != null && defaultArg != null) {
    databases = dbsArg
    defaultKey = defaultArg
  } else if (pouchdb != null) {
    defaultKey = name ?? pouchdb.name
    databases = { [defaultKey]: pouchdb }
  } else {
    throw new TypeError(
      'databases argument must be pared with the default argument'
    )
  }

  const contextObjects = useAddSubscriptionManager(databases)

  const parentContext = useReactContext(PouchContext)

  // merge the contextObjects into the parent context and set the "default" key
  const context = useMemo(() => {
    return {
      ...parentContext,
      ...contextObjects,
      default: contextObjects[defaultKey],
    }
  }, [contextObjects, defaultKey, parentContext])

  return (
    <PouchContext.Provider value={context}>
      {args.children}
    </PouchContext.Provider>
  )
}

/**
 * Creates for every database a SubscriptionManager.
 * Memorizes all databases and reuses the SubscriptionManagers of them.
 * Also unsubscribes SubscriptionManager.
 * @param databases HashMap containing PouchDB databases.
 */
function useAddSubscriptionManager(databases: {
  [key: string]: PouchDB.Database
}): ContextObject {
  // memory for last DB and SubscriptionManager pairs
  const lastContextObject = useRef<ContextObject>({})

  useEffect(
    () => () => {
      // unsubscribe all SubscriptionManager when the component un-mounts
      for (const pair of Object.values(lastContextObject.current)) {
        pair.subscriptionManager.unsubscribeAll()
      }
    },
    []
  )

  const allLastKeys = Object.keys(lastContextObject.current)
  // Keys of last lastContextObject
  // All databases that didn't change will be reused and their keys deleted from this Set.
  // All keys left, the database did change and the SubscriptionManager will be unsubscribed.
  const lastKeys = new Set(allLastKeys)

  const contextObjects: ContextObject = {}
  let didAddNewDatabase = false

  for (const [key, db] of Object.entries(databases)) {
    if (lastKeys.has(key) && db === lastContextObject.current[key].pouchdb) {
      contextObjects[key] = lastContextObject.current[key]
      lastKeys.delete(key)
    } else {
      didAddNewDatabase = true
      contextObjects[key] = {
        pouchdb: db,
        subscriptionManager: new SubscriptionManager(db),
      }
    }
  }

  // no database was created and no database got removed, or did change --> use the old one
  if (!didAddNewDatabase && lastKeys.size === 0) {
    return lastContextObject.current
  }

  // unsubscribe all SubscriptionManagers who's database did change/got removed.
  for (const key of lastKeys) {
    lastContextObject.current[key].subscriptionManager.unsubscribeAll()
  }

  lastContextObject.current = contextObjects
  return contextObjects
}

/**
 * Provides access to the Database & SubscriptionManager pair in the usePouchDB-Context.
 * @param name Name of the Database or its overwritten name. Defaults to "default".
 */
export function useContext(name = 'default'): PouchContextObject {
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
