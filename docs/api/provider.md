---
id: provider
title: <Provider />
sidebar_label: Provider
---

## Overview

The `<Provider />` component makes one or multiple PouchDB databases available to any nested components' hooks.

You can't use the hooks unless they are invoked from a component nested inside of a `<Provider />`.

Most apps will render the `<Provider />` as one of the most top level components, with the entire app's component
tree inside of it. But they can be nested.

Every `<Provider />` has a _default database_. The _default database_ is used whenever the `db`
option of the **hooks** is not used. This `db`-option selects the database the hook will use. For a
single database `<Provider />` that database is the default. A multi database `<Provider />`
requires a `default` prop that selects the default database by it's key.

If a `<Provider />` is nested inside of another `<Provider />`, the child will merge the databases
of the parent into it's databases set. But overwrites any database with conflicting keys.
The default is also overwritten.

For overwriting databases the child `<Provider />` uses `Object.assign({}, parentDBs, ownDBs)`.
The child shadows the parent.

## Props

`<Provider />` has two sets of props:

- single database
- multi databases

### Props single database

`pouchdb` ([PouchDB database](https://pouchdb.com/api.html#create_database)) The PouchDB database you want to
provide to the child components.

`name` (String optional) Name to use when selecting that database with a hook's `db` option.
Defaults to the `name` field of the database.

`children` (ReactElement) The root of your component hierarchy, which should have access to this database.

### Props multi databases

`databases` (Object) Object of [PouchDB databases](https://pouchdb.com/api.html#create_database).
The key used, is the key by which a database can be selected at the `db` options of **hooks**.

`default` (String) Key of the default database. This can also be the key of a parent database. _Required_.

`children` (ReactElement) The root of your component hierarchy, which should have access to this database.

## Example Usage

In the Examples below `<App />` is the top most component, that contains all of your app.

### Vanilla React Example

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

import { App } from './App'

const db = new PouchDB('local')

ReactDOM.render(
  <Provider pouchdb={db}>
    <App />
  </Provider>,
  document.getElementById('root')
)
```

### Multiple databases

Hooks access the _local_ database if `undefined`, `null`, `"_default"` or `"local"` is passed to
their `db` option. To access the _remote_ database you must pass `remote` to the hook's `db` option.

To change the _default database_, change the `default`'s value. All hooks that access the
_default database_ will re-query, using the new _default database_, while still returning the old
content.

This pattern can be used for the first visit: Use the remote db when no local data exist.
But sync in the background. Once all data is locally available, fetch all used views and indexes on
the local db, which will start the indexing. And then switch to the local db.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import PouchDB from 'pouchdb-browser'

import { Provider } from 'use-pouchdb'

import App from './App'

const db = new PouchDB('local_data')
const remoteDb = new PouchDB('https://example.com/db')

ReactDOM.render(
  <Provider
    default="local"
    databases={{
      local: db,
      remote: remoteDb,
    }}
  >
    <App />
  </Provider>,
  document.getElementById('root')
)
```

### Usage with React Router

I recommend using `usePouchDB` with an routing solution, like
[React Router](https://reacttraining.com/react-router/).

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

import { App } from './App'
import { Other } from './Other'
import { More } from './More'
import { Header } from './Header'

const db = new PouchDB('local')

ReactDOM.render(
  <Provider pouchdb={db}>
    <Router>
      <Header />

      <Switch>
        <Route path="/other">
          <Other />
        </Route>

        <Route path="/more">
          <More />
        </Route>

        <Route path="/">
          <App />
        </Route>
      </Switch>
    </Router>
  </Provider>,
  document.getElementById('root')
)
```

### With Redux and React-Redux

There are also some [Redux-PouchDB packages](https://pouchdb.com/external.html#framework_adapters), for example
[redux-pouchdb](https://github.com/vicentedealencar/redux-pouchdb).

Read more about [Redux](https://redux.js.org/) and [React-Redux](https://react-redux.js.org/) at their sites.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'react-redux'
import PouchDB from 'pouchdb-browser'
import { Provider as PouchProvider } from 'use-pouchdb'

import { App } from './App'
import createStore from './createReduxStore'

const store = createStore()

const db = new PouchDB('local')

ReactDOM.render(
  <Provider store={store}>
    <PouchProvider pouchdb={db}>
      <App />
    </PouchProvider>
  </Provider>,
  document.getElementById('root')
)
```

While you don't need to use Redux and can build full apps using only usePouchDB.
You might already use Redux. Or if you want to share complicated derived state between multiple
components Redux might be a tool for you.

You can use both at the same time.

### Extending the context

Databases can be made available to a subtree, while still be able to access all other databases.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

import { Main } from './Main'
import { UserMenu } from './UserMenu'

const db = new PouchDB('local')

ReactDOM.render(
  <Provider pouchdb={db}>
    <div>
      <Main />
      <UserMenu />
    </div>
  </Provider>,
  document.getElementById('root')
)
```

and in UserMenu.js:

```jsx
import React from 'react'
import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

// Menu will only have access to the remote database
import Menu from './Menu'

const remote = new PouchDB('https://example.com/db')

export function UserMenu() {
  return (
    <Provider pouchdb={remote} name="remote">
      <Menu />
    </Provider>
  )
}
```

Hooks in `<Menu />` access the _remote_ database by default, or if you pass `undefined`, `null`,
`"remote"` or `"_default"` to the `db` option. You can still access the _local_ database if you
pass `"local"` into the `db` option.
