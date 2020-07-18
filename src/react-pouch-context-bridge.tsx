import React, { useState, useMemo, useEffect, ReactNode } from 'react'
import { useDB } from 'react-pouchdb'

import { Provider } from './context'
import { useDeepMemo } from './utils'

export interface ReactPouchContextBridgeArguments {
  /**
   * Name of the database that should be the default database.
   */
  default: string
  /**
   * Array of database names that should be mapped from react-pouch's context to
   * usePouchDB's context.
   */
  names?: string[]
  /**
   * Children to render.
   */
  children: JSX.Element | ReactNode
}

type DBsObject = { [key: string]: PouchDB.Database }

/**
 * Bridge Databases from the react-pouchdb context to usePouchDB's context.
 *
 * This Component is to ease the transition from usePouchDB to react-pouchdb.
 * @param param React params
 * @param param.default  Name of the database that should be the default database.
 * @param param.names    Array of database names that should be mapped from react-pouch's context
 *                        to usePouchDB's context.
 * @param param.children Children component tree.
 */
export default function ReactPouchContextBridge({
  default: defaultName,
  names,
  children,
}: ReactPouchContextBridgeArguments): React.ReactElement {
  const databaseNamesList = useDeepMemo(names)

  const databaseNames = useMemo(() => {
    if (!Array.isArray(databaseNamesList) || databaseNamesList.length === 0) {
      return [defaultName]
    } else if (databaseNamesList.includes(defaultName)) {
      return databaseNamesList
    } else {
      return [defaultName].concat(databaseNamesList)
    }
  }, [defaultName, databaseNamesList])

  const [databases, setDatabases] = useState<DBsObject>({})

  return (
    <>
      <DbBridge nameList={databaseNames} onChange={setDatabases} />

      {Object.keys(databases).length > 0 && (
        <Provider databases={databases} default={defaultName}>
          {children}
        </Provider>
      )}
    </>
  )
}

function DbBridge({
  databases,
  nameList,
  onChange,
}: {
  databases?: DBsObject
  nameList: string[]
  onChange: (dbs: DBsObject) => void
}) {
  const dbName = nameList[0]
  const nextNameList = useMemo(() => nameList.slice(1), [nameList])

  const db = useDB(dbName)

  const nextDatabasesObject = useMemo(
    () => ({
      ...(databases ?? {}),
      [dbName]: db,
    }),
    [db, dbName, databases]
  )

  useEffect(() => {
    if (nextNameList.length === 0) {
      onChange(nextDatabasesObject)
    }
  }, [nextDatabasesObject, nextNameList, onChange])

  if (nextNameList.length === 0) {
    return null
  }

  return (
    <DbBridge
      databases={nextDatabasesObject}
      nameList={nextNameList}
      onChange={onChange}
    />
  )
}
