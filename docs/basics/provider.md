---
id: provider
title: Add the Provider
---

Now we'll enter React land!

First we need to create a PouchDB database and make it available to our app. To do this, we wrap our app with the `<Provider />` API provided by usePouchDB. But unlike with [React-Redux's `<Provider />`](https://react-redux.js.org/api/provider) we won't be doing it in `index.js`, but in the `App.js` component.

```jsx
// App.js
import React, { useState, useEffect } from 'react'
import './App.css'

import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

export default function App() {
  const [db, setDB] = useState(() => new PouchDB('local'))

  useEffect(() => {
    const listener = dbName => {
      if (dbName === 'local') {
        setDB(new PouchDB('local'))
      }
    }

    PouchDB.on('destroyed', listener)
    return () => {
      db.close()
      PouchDB.removeListener('destroyed', listener)
    }
  }, [db])

  return (
    <Provider pouchdb={db}>
      <div className="App">Add the future components here</div>
    </Provider>
  )
}
```

What is happening here?

A local database contains the data of an user. When a user logs out, we must delete their data. When we [destroy](https://pouchdb.com/api.html#delete_database) a db, all it's data will be deleted, without syncing the deletion. The database will be completely removed from disk.

But we can't use a destroyed database in hooks! That's why we instantly re-create a new database with the same name. But it will not have any data from the old one.

[`db.close()`](https://pouchdb.com/api.html#close_database) is there to remove all event listeners from the database. All hooks from usePouchDB will auto-remove listeners if the db in the `<Provider pouchdb={db} />` did change.

> Note that this is a workaround! Future updates of **usePouchDB** will have nicer APIs for handling login/logout.
