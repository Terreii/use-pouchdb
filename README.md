# usePouchDB

[![Build Status](https://travis-ci.com/Terreii/use-pouchdb.svg?branch=latest)](https://travis-ci.com/Terreii/use-pouchdb)
[![dependencies Status](https://david-dm.org/Terreii/use-pouchdb/status.svg)](https://david-dm.org/Terreii/use-pouchdb)
[![devDependencies Status](https://david-dm.org/Terreii/use-pouchdb/dev-status.svg)](https://david-dm.org/Terreii/use-pouchdb?type=dev)
[![peerDependencies Status](https://david-dm.org/Terreii/use-pouchdb/peer-status.svg)](https://david-dm.org/Terreii/use-pouchdb?type=peer)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Known Vulnerabilities](https://snyk.io/test/github/Terreii/use-pouchdb/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Terreii/use-pouchdb?targetFile=package.json)
[![npm](https://img.shields.io/npm/v/use-pouchdb)](https://www.npmjs.com/package/use-pouchdb)

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
only want to quick start, read on...

### Installation

usePouchDB requires **React 16.8.3 or later**.

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

To use the `useView` hook [`pouchdb-mapreduce`](https://www.npmjs.com/package/pouchdb-mapreduce)
must be installed and setup. If you use the [`pouchdb`](https://www.npmjs.com/package/pouchdb) or
[`pouchdb-browser`](https://www.npmjs.com/package/pouchdb-browser) packages, it is already setup.

```sh
npm install pouchdb-mapreduce
# or
yarn add pouchdb-mapreduce
```

For using the `useFind` hook [`pouchdb-find`](https://www.npmjs.com/package/pouchdb-find)
must be installed and setup.

```sh
npm install pouchdb-find
# or
yarn add pouchdb-find
```

### Bind usePouchDB

usePouchDB exports a `<Provider />` to make one or multiple PouchDB databases available to its
components sub-tree.

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

- [`usePouch`](https://christopher-astfalk.de/use-pouchdb/docs/api/use-pouch) - Access the database
  provided by `<Provider />`.
- [`useDoc`](https://christopher-astfalk.de/use-pouchdb/docs/api/use-doc) - Access a single document
  and subscribe to its changes. The hook version of [`db.get`](https://pouchdb.com/api.html#fetch_document).
- [`useAllDocs`](https://christopher-astfalk.de/use-pouchdb/docs/api/use-all-docs) - Load multiple documents
  and subscribe to their changes. Or a range of docs by their ids. The hook version of
  [`db.allDocs`](https://pouchdb.com/api.html#batch_fetch).
- [`useFind`](https://christopher-astfalk.de/use-pouchdb/docs/api/use-find) - Access a mango index and
  subscribe to it. Optionally create the index, if it doesn't exist. The hook version of
  [`db.createIndex`](https://pouchdb.com/api.html#create_index) and
  [`db.find`](https://pouchdb.com/api.html#query_index) combined.
- [`useView`](https://christopher-astfalk.de/use-pouchdb/docs/api/use-view) - Access a view and subscribe
  to its changes. The hook version of [`db.query`](https://pouchdb.com/api.html#query_database).

### Example

Load a single document and display it. [`useDoc`](https://christopher-astfalk.de/use-pouchdb/docs/api/use-doc)
is the hook version of [`db.get`](https://pouchdb.com/api.html#fetch_document), but it also
subscribes to updates of that document and automatically loads the new version.

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
