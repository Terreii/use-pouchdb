# usePouchDB

[React Hooks](https://reactjs.org/) for [PouchDB](https://pouchdb.com/).

## Overview

usePouchDB is a collection of React Hooks to access data in a PouchDB database from React components.

The goal of usePouchDB is to ease the use of PouchDB with React. Enabling developers to create
[offline first apps](http://hood.ie/blog/say-hello-to-offline-first.html).

## Quick-start

[You can find the Getting Started docs here](https://christopher-astfalk.de/use-pouchdb) (or on [GitHub](./docs/)).

These docs walk you through setting up PouchDB and usePouchDB. They give you also a quick
introduction to [PouchDB](https://pouchdb.com/) and [Apache CouchDB](https://couchdb.apache.org/).
But [PouchDB's Guides](https://pouchdb.com/guides/) are recommended to learn PouchDB.

[You can find a introduction to React here](https://reactjs.org/tutorial/tutorial.html).

If you know what you're doing and
just want to quick start, read on...

### Installation

usePouchDB requires **React 16.8.3 or later**.

To use usePouchDB with your React app:

```sh
npm install use-pouchdb
# or
yarn add use-pouchdb
```

You'll also need to [install PouchDB](https://pouchdb.com/guides/setup-pouchdb.html 'PouchDBs installation guide').
There is also a special [browser version](https://www.npmjs.com/package/pouchdb-browser):

```sh
npm install pouchdb-browser
# or
yarn add pouchdb-browser
```

### Bind usePouchDB

usePouchDB exports a `<Provider />` to make a PouchDB database available to its components sub-tree.

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

### Hooks

[All hooks are listed here](https://christopher-astfalk.de/use-pouchdb/docs/introduction/quick_start).

### Example

Load a single document and display it.

```jsx
import React from 'react'
import { useDoc } from 'use-pouchdb'

export default function Post({ postId }) {
  const { doc, loading, error } = useDoc(postId)

  if (error && !loading) {
    return <div>something went wrong: {error.name}</div>
  }

  if (doc == null && loading) {
    return null
  }

  return (
    <article>
      <div>
        <h3>{doc.author}</h3>
        <p>{doc.text}</p>
      </div>
    </article>
  )
}
```

## Changelog

usePouchDB follows [semantic versioning](https://semver.org/). To see a changelog with all
usePouchDB releases, check out the
[Github releases page](https://github.com/Terreii/use-pouchdb/releases).

## Contributing

Contributions in all forms are welcomed. ♡

If you have questions, [Contributing.md](https://github.com/Terreii/use-pouchdb/blob/latest/CONTRIBUTING.md) might answer your questions.

To create a welcoming project to all, this project uses and enforces a
[Code of Conduct](https://github.com/Terreii/use-pouchdb/blob/latest/CODE_OF_CONDUCT.md).
