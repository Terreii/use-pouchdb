---
id: quick_start
title: Quick Start
---

[usePouchDB](https://github.com/Terreii/use-pouchdb) is a collection of _React Hooks_ to access data in a
_PouchDB database_.

## Purpose

usePouchDB is intended to be used by small
[CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete 'CRUD on Wikipedia') apps and more complicated
Web-Apps alike. It was originally created by me, after I realized that with [PouchDB](https://pouchdb.com/) (and
its [vast plugin ecosystem](https://pouchdb.com/external.html 'List of plugins for PouchDB')),
[CouchDB](https://couchdb.apache.org/) as the data backend and [React](https://reactjs.org/) with
[Hooks](https://reactjs.org/docs/hooks-intro.html), you have everything you need to build a CRUD Web-App.

It is now intended to be a puzzle piece in the replacement of CouchApps (the ones that use the deprecated
[show](https://docs.couchdb.org/en/3.1.0/ddocs/ddocs.html#show-functions) and
[list](https://docs.couchdb.org/en/3.1.0/ddocs/ddocs.html#list-functions) functions).

> Note that usePouchDB is, for now, only optimized for local DBs and not for accessing a DB over HTTP!
>
> It subscribes to all changes and once for every view! And every subscription is a HTTP request.
> It will still work, but could exceed the 4 concurrent request per domain limit on HTTP 1.1.

## Installation

usePouchDB requires **React 16.8.3 or later**.

To use usePouchDB with your React app:

```sh
npm install use-pouchdb
```

or

```sh
yarn add use-pouchdb
```

You'll also need to [install PouchDB](https://pouchdb.com/guides/setup-pouchdb.html 'PouchDBs installation guide').
There is also a special [browser version](https://www.npmjs.com/package/pouchdb-browser).

[PouchDB Authentication](https://github.com/pouchdb-community/pouchdb-authentication) is a PouchDB
plugin for the sign up, log in and log out flow.

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D pouchdb-browser pouchdb-authentication
```

<!--yarn-->

```sh
yarn add -D pouchdb-browser pouchdb-authentication
```

<!--END_DOCUSAURUS_CODE_TABS-->

## Provider

usePouchDB provides a `<Provider />`, to make a PouchDB database available to it's child components.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import PouchDB from 'pouchdb-browser'

import { Provider } from 'use-pouchdb'

import App from './App'

const db = new PouchDB('local')

ReactDOM.render(
  <Provider pouchdb={db}>
    <App />
  </Provider>,
  document.getElementById('root')
)
```

## useDoc

usePouchDB provides a `useDoc` hook to access a single document. It automatically subscribes to updates of that
document.

```jsx
import React from 'react'

import { useDoc } from 'use-pouchdb'

export default function BlogPost({ id }) {
  const { doc, state, loading, error } = useDoc(id)

  if (loading && doc == null) {
    return <Loading />
  }

  if (state === 'error' && error) {
    return <Error error={error} />
  }

  return (
    <article>
      <DocDisplay doc={doc} />
    </article>
  )
}
```

## useAllDocs

The [allDocs method](https://pouchdb.com/api.html#batch_fetch) is accessible using the `useAllDocs` hook. It, too,
automatically subscribes to updates of those documents (and new ones).

```jsx
import React from 'react'

import { useAllDocs } from 'use-pouchdb'

export default function AllPosts() {
  const { rows, offset, total_rows, state, loading, error } = useAllDocs({
    startkey: 'posts:',
    endkey: 'posts:\uffff',
    include_docs: true,
  })

  if (loading && rows.length === 0) {
    return <Loading />
  }

  if (state === 'error' && error) {
    return <Error error={error} />
  }

  return (
    <div>
      {rows.map(row => (
        <PostPreview key={row.id} post={row.doc} />
      ))}
    </div>
  )
}
```

## useView

Accessing a [view](https://docs.couchdb.org/en/stable/ddocs/views/index.html 'CouchDBs Guide to Views') ([PouchDBs
query](https://pouchdb.com/api.html#query_database 'Documentation about db.query')) is accomplished using the hook
`useView`. It also automatically subscribes to updates of that view.

```jsx
import React from 'react'

import { useView } from 'use-pouchdb'

export default function Comments({ id }) {
  const { rows, offset, total_rows, state, loading, error } = useView(
    'blog/comments', // use the view 'comments' in '_design/blog' design document
    {
      startkey: [id],
      endkey: [id, {}],
      include_docs: true,
    }
  )

  if (loading && rows.length === 0) {
    return <Loading />
  }

  if (state === 'error' && error) {
    return <Error error={error} />
  }

  return (
    <div>
      {rows.map(row => (
        <Comment key={row.key.join('_')} comment={row.doc} />
      ))}
    </div>
  )
}
```

## usePouch

Sometimes you need more direct access to a PouchDB instance. `usePouch` gives you access to the database provided
to `<Provider />`.

```jsx
import { useCallback } from 'react'

import { usePouch } from 'use-pouchdb'

export function useDelete(errorCallback) {
  const db = usePouch()

  return useCallback(
    async id => {
      try {
        const doc = await db.get(id)

        await db.remove(doc)
      } catch (error) {
        errorCallback(error)
      }
    },
    [db, errorCallback]
  )
}
```
