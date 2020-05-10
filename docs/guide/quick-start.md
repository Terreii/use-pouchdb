---
layout: default
---

# Quick Start

[usePouchDB](https://github.com/Terreii/use-pouchdb) is a collection of *React Hooks* to access data in an PouchDB database.

## Installation

usePouchDB requires __React 16.8.3 or later__.

To use usePouchDB with your React app:

```sh
npm install use-pouchdb
```

or

```sh
yarn add use-pouchdb
```

You'll also need to [install PouchDB](https://pouchdb.com/guides/setup-pouchdb.html "PouchDBs installation guide"). There is also a special [browser version](https://www.npmjs.com/package/pouchdb-browser).

## Provider

usePouchDB provides a ```<Provider />```, to make a PouchDB database available to it's child components.

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

usePouchDB provides a `useDoc` hook to access a single document. It automatically subscribes to updates of that document.

```jsx
import React from 'react'

import { useDoc } from 'use-pouchdb'

export default function BlogPost ({ id }) {
  const { doc, state, isLoading, error } = useDoc(id)

  if (isLoading && doc == null) {
    return <Loading />
  }

  if (state === 'error' && error) {
    return <Error error={error} />
  }

  return (
    <article>
      <DocDisplay doc={doc}>
    </article>
  )
}
```

## useAllDocs

The [allDocs Method](https://pouchdb.com/api.html#batch_fetch) is accessible using the `useAllDocs` hook. It, too, automatically subscribes to updates of those documents (and new ones).

```jsx
import React from 'react'

import { useAllDocs } from 'use-pouchdb'

export default function AllPosts () {
  const { rows, offset, total_rows, state, isLoading, error } = useAllDocs({
    startkey: 'posts:',
    endkey: 'posts:\uffff',
    include_docs: true,
  })

  if (isLoading && rows.length === 0) {
    return <Loading />
  }

  if (state === 'error' && error) {
    return <Error error={error} />
  }

  return (
    <div>
      {rows.map(row => (
        <PostPreview
          key={row.id}
          post={row.doc}
        />
      ))}
    </div>
  )
}
```

## useQuery

Accessing a [view](https://docs.couchdb.org/en/stable/ddocs/views/index.html "CouchDBs Guide to Views") accomplished using the hook `useQuery`. It also automatically subscribes to updates of that view.

```jsx
import React from 'react'

import { useQuery } from 'use-pouchdb'

export default function Comments ({ id }) {
  const { rows, offset, total_rows, state, isLoading, error } = useQuery(
    'blog/comments',
    {
      startkey: [id],
      endkey: [id, {}],
      include_docs: true,
    }
  )

  if (isLoading && rows.length === 0) {
    return <Loading />
  }

  if (state === 'error' && error) {
    return <Error error={error} />
  }

  return (
    <div>
      {rows.map(row => (
        <Comment
          key={row.key.join('_')}
          comment={row.doc}
        />
      ))}
    </div>
  )
}
```

## usePouch

Sometimes you need more direct access to a PouchDB instance. `usePouch` gives you access to it.

```jsx
import { useCallback } from 'react'

import { usePouch } from 'use-pouchdb'

export function useDelete (errorCallback) {
  const db = usePouch()

  return useCallback(async id => {
    try {
      const doc = await db.get(id)
  
      await db.remove(doc)
    } catch (error) {
      errorCallback(error)
    }
  }, [db, errorCallback])
}
```
