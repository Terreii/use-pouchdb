---
id: provider
title: <Provider />
sidebar_label: Provider
---

## Overview

The `<Provider />` component makes a PouchDB database available to any nested components' hooks.

Most apps will render the `<Provider />` as one of the most top level components, with the entire app's component
tree inside of it.

You can't use the hooks unless they are invoked from a component nested inside of a `<Provider />`.

## Props

`pouchdb` ([PouchDB database](https://pouchdb.com/api.html#create_database)) The PouchDB database you want to
provide to the child components.

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

### Overwriting the context

The database can be overwritten for a sub-tree.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

import { Main } from './Main'
import { UserMenu } from 'UserMenu'

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
    <Provider pouchdb={remote}>
      <Menu />
    </Provider>
  )
}
```
