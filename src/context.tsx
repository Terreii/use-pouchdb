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
  getSubscriptionManager: () => SubscriptionManager
}

type ContextObject = { [key: string]: PouchContextObject }

type SubscriptionManagerCache = {
  [key: string]: {
    pouchdb: PouchDB.Database
    subscriptionManager: SubscriptionManager
  }
}

const PouchContext = /*#__PURE__*/ createContext<{
  defaultKey: string
  databases: ContextObject
}>({
  defaultKey: '',
  databases: {},
})

if (process.env.NODE_ENV !== 'production') {
  PouchContext.displayName = 'UsePouchDBContext'
}

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
  const { databases: dbsArg, default: defaultArg } =
    args as MultiDbProviderArguments

  // collection of databases added in this Provider
  let databases: { [key: string]: PouchDB.Database }
  // key of the default database
  let defaultKey: string

  // normalize the two argument types into one
  if (dbsArg != null && defaultArg != null) {
    databases = dbsArg
    defaultKey = defaultArg.toString()
  } else if (pouchdb != null) {
    defaultKey = name?.toString() || pouchdb.name
    databases = { [defaultKey]: pouchdb }
  } else {
    throw new TypeError(
      'databases argument must be pared with the default argument'
    )
  }

  const contextObjects = useAddSubscriptionManager(databases)

  const parentDatabases = useReactContext(PouchContext).databases

  // merge the contextObjects into the parent context and set the "default" key
  const context = useMemo(() => {
    return {
      defaultKey,
      databases: {
        ...parentDatabases,
        ...contextObjects,
      },
    }
  }, [contextObjects, defaultKey, parentDatabases])

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
  const subscriptionManagers = useRef<SubscriptionManagerCache>({})
  const contextObjectCache = useRef<ContextObject>({})

  useEffect(
    () => () => {
      // unsubscribe all SubscriptionManager when the component un-mounts
      for (const [key, pair] of Object.entries(subscriptionManagers.current)) {
        pair.subscriptionManager.unsubscribeAll()
        delete subscriptionManagers.current[key]
      }
    },
    []
  )

  const contextObjects = useMemo(() => {
    // Clean up any stored subscriptionManagers which no longer match the
    // databases prop.
    for (const key of Object.keys(subscriptionManagers.current)) {
      if (
        !databases.hasOwnProperty(key) ||
        databases[key] !== subscriptionManagers.current[key].pouchdb
      ) {
        subscriptionManagers.current[key].subscriptionManager.unsubscribeAll()
        delete subscriptionManagers.current[key]
      }
    }

    const objs: ContextObject = {}
    for (const [key, db] of Object.entries(databases)) {
      // Use a ref cache to retain referential equality for context objects as
      // long as the key and database match.
      const cachedContext = contextObjectCache.current[key]
      if (db === cachedContext?.pouchdb) {
        objs[key] = cachedContext
      } else {
        objs[key] = {
          pouchdb: db,
          getSubscriptionManager: () => {
            if (!subscriptionManagers.current.hasOwnProperty(key)) {
              subscriptionManagers.current[key] = {
                pouchdb: db,
                subscriptionManager: new SubscriptionManager(db),
              }
            }
            return subscriptionManagers.current[key].subscriptionManager
          },
        }
      }
    }
    contextObjectCache.current = objs
    return objs
  }, [databases])

  return contextObjects
}

/**
 * Provides access to the Database & SubscriptionManager pair in the usePouchDB-Context.
 * @param name Name of the Database or its overwritten name. Defaults to "default".
 */
export function useContext(name?: string): PouchContextObject {
  const { defaultKey, databases } = useReactContext(PouchContext)

  if (
    defaultKey === '' &&
    databases[defaultKey] == null &&
    Object.keys(databases).length === 0
  ) {
    throw new Error(
      'could not find PouchDB context value; please ensure the component is wrapped in a <Provider>'
    )
  }

  const key = name === '_default' ? defaultKey : name ?? defaultKey

  if (!(key in databases)) {
    throw new Error(`could not find a PouchDB database with name of "${name}"`)
  }

  return databases[key]
}
