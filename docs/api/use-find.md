---
id: use-find
title: useFind
---

## Overview

Query, and optionally create, a [Mango query](https://pouchdb.com/guides/mango-queries.html).
It uses the [Mango query language](https://docs.couchdb.org/en/3.1.0/api/database/find.html#selector-syntax).

It also subscripts to updates of the index. With the added bonus of also subscribing to updates of
the documents in the [result](#result). If you update or delete a document in a way that would
remove it from the index, than it will be removed from the result of this hook. Even if `_id` is
not included in `fields`.

`useFind` can only be invoked from a component nested inside of a `<Provider />`.

> `useFind` requires [`pouchdb-find`](https://www.npmjs.com/package/pouchdb-find) to be
> installed and setup.

## Parameters

`useFind` has a combination of PouchDB's [`db.find()`](https://pouchdb.com/api.html#query_index)
and [`db.createIndex()`](https://pouchdb.com/api.html#create_index) options.
Options descriptions are copied from the PouchDB API page.

1. `options: object` - Option object.
   - `options.index?: string | [string, string] | CreateIndexOption` - Select an index or ensure
     an index exist. It can be:
     - `string` - Select the design-doc to be used. It is like
       [`db.find()`'s `use_index`](https://pouchdb.com/api.html#query_index).
     - `[string, string]` - Select the design-doc and index name. It is like
       [`db.find()`'s `use_index`](https://pouchdb.com/api.html#query_index).
     - `object` - Ensure that that index exist, create it if not.
       The hook will then use that index. It is the `index` field, passed into
       [`db.createIndex()`](https://pouchdb.com/api.html#create_index).
       - `options.index.fields: string[]` - A list of fields to index.
         The [order matters](https://pouchdb.com/guides/mango-queries.html#more-than-one-field)!
       - `options.index.name?: string` - Name of the index, auto-generated if not included.
       - `options.index.ddoc?: string` - design document name (i.e. the part after `'_design/'`),
         auto-generated if you don’t include it
       - `options.index.type?: string` - Type of the index. Only `json` is supported,
         which is also the default.
   - `options.selector: PouchDB.Find.Selector` - The selector to filter the results. Required.
     It uses [Mango Selector Syntax](https://docs.couchdb.org/en/3.1.0/api/database/find.html#selector-syntax).
   - `options.fields?: string[]` - List of fields that you want to receive.
     If omitted, you get the full documents.
   - `options.sort?: string[]` - List of fields defining how you want to sort.
     Note that sorted fields also have to be selected in the `options.selector`.
   - `options.limit?: number` - Maximum number of documents to return.
   - `options.skip?: number` - Number of docs to skip before returning.

> `index`, `selector`, `fields` and `sort` are check for equality with a deep equal algorithm.
> And only if they differentiate by _value_ will a new query be made.

> Note: `useFind` will call `db.createIndex` every time the `index` object's values changed!
> It will happily create a new index on every render!

## Result

`useFind` results an object with those fields:

- `docs: object[]` - Array of objects that contain the requested documents.
  Empty during the first fetch or during an error. Each object has only the requested fields,
  or the full document if no `fields` array was defined.
- `warning?: string` - If `db.find()` returns a warning, it will be included here.
  For example if no matching index was found. Create an index in the `options.index` field if no index was found.
- `state: 'loading' | 'done' | 'error'` - Current state of the hook.
  - `loading` - It is loading the documents. Or it is loading the updated version of them.
  - `done` - The documents are loaded, and no update is being loaded.
  - `error` - There was an error with fetching the documents. Look into the `error` field.
- `loading: boolean` - It is loading. The state is `loading`. This is just a shorthand.
- `error: PouchDB.Error | null` - If there was an error, then this field will contain the error.
  The error is reset to `null` once a fetch was successful.

## Example Usage

### Ensure that an index exist

If the index field contains an object with an fields-field, useFind will ensure that that index exist.
If the index doesn't exist, it will be created.

This is the recommended usage.

```jsx
import React from 'react'
import { useFind } from 'use-pouchdb'

export default function StoryList() {
  const { docs, loading, error } = useFind({
    // Ensure that this index exist, create it if not. And use it.
    index: {
      fields: ['type', 'title'],
    },
    selector: {
      type: 'story',
      title: { $exists: true },
    },
    sort: ['title'],
    fields: ['_id', 'title'],
  })

  return (
    <main>
      <h1>Stories</h1>

      {error && (
        <p>
          Error: {error.status} - {error.name}
        </p>
      )}
      {loading && docs.length === 0 && <p>loading...</p>}

      <ul>
        {docs.map(doc => (
          <li key={doc._id}>
            <a href={`./${doc._id}`}>{doc.title}</a>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

### Use existing index

```jsx
import React from 'react'
import { useFind } from 'use-pouchdb'

export default function StoryList() {
  const { docs, loading, error } = useFind({
    // Index is here like use_index in db.find()
    index: ['ddoc_name', 'index_name'],
    selector: {
      type: 'story',
      title: { $exists: true },
    },
    sort: ['title'],
    fields: ['_id', 'title'],
  })

  return (
    <main>
      <h1>Stories</h1>

      {error && (
        <p>
          Error: {error.status} - {error.name}
        </p>
      )}
      {loading && docs.length === 0 && <p>loading...</p>}

      <ul>
        {docs.map(doc => (
          <li key={doc._id}>
            <a href={`./${doc._id}`}>{doc.title}</a>
          </li>
        ))}
      </ul>
    </main>
  )
}
```
