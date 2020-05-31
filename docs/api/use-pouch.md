---
id: use-pouch
title: usePouch
---

## Overview

Sometimes you need more than the provided hooks alow, the `usePouch` is for those moments. `usePouch` returns a
reference to the [PouchDB database](https://pouchdb.com/api.html#create_database) past into `<Provider />`.

It can only be invoked from a component nested inside of a `<Provider />`.

## Parameters

`usePouch` doesn't have any parameters, yet.

## Result

`usePouch` returns a reference to the [PouchDB database](https://pouchdb.com/api.html#create_database) past into
`<Provider />`.

## Example Usage

The `usePouch` hook is for everything not covered by the provided hooks.

### Sync

Access the pouchdb instance to start sync to another database. Read more about
[syncing at PouchDB's API documentation](https://pouchdb.com/api.html#sync) or
[PouchDB's Replication guide](https://pouchdb.com/guides/replication.html).

```jsx
import React, { useState, useEffect } from 'react'
import PouchDB from 'pouchdb-browser'
import { usePouch } from 'use-pouchdb'

export function SyncComponent({ username, password }) {
  // get the database you want to sync
  const db = usePouch()

  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (!username || !password) {
      return
    }

    const url = new URL('/db', window.location.href)
    // create the remote database with authentication
    const remote = new PouchDB(url.href, {
      auth: {
        username,
        password,
      },
    })

    // start syncing
    const sync = db
      .sync(remote, { live: true, retry: true })
      .on('paused', () => {
        setIsSyncing(false)
      })
      .on('active', () => {
        setIsSyncing(true)
      })
      .on('denied', err => {
        // handle permission errors
      })

    return () => {
      // stop syncing
      sync.cancel()
    }
  }, [db, username, password])

  if (!isSyncing) {
    return null
  }

  return <div>syncing your data</div>
}
```

### Creating your own hooks

With access to the database, you can create your own hooks.

```javascript
import { useCallback } from 'react'
import { usePouch } from 'use-pouchdb'

export function useAddBooking() {
  const db = usePouch()

  return useCallback(
    async (amount, name) => {
      if (typeof amount !== 'number') {
        throw new TypeError('amount must be a number!')
      }

      const doc = {
        _id: `booking_${new Date().toJSON()}`,
        type: 'booking',
        name: name || 'unknown',
        amount: amount,
      }

      const result = await db.put(doc)

      return result
    },
    [db]
  )
}
```

and then in your component:

```jsx
import React, { useState } from 'react'

import { useAddBooking } from './hooks'

export function NewBooking() {
  const addBooking = useAddBooking()

  const [name, setName] = useState()
  const [amount, setAmount] = useState(0)

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        addBooking(amount, name)
      }}
    >
      <label>
        Name of booking
        <input
          type="text"
          value={name}
          onChange={event => {
            setName(event.target.value)
          }}
        />
      </label>

      <label>
        Amount
        <input
          type="number"
          required
          value={amount}
          onChange={event => {
            setAmount(event.target.value)
          }}
        />
      </label>

      <button>add</button>
    </form>
  )
}
```
