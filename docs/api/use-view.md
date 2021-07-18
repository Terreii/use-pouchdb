---
id: use-view
title: useView
---

## Overview

For accessing a [map-reduce view](https://pouchdb.com/guides/queries.html) use the `useView` hook.

It also subscripts to updates of the view. With the added bonus of also subscribing to updates of the documents in
the [result](#result). If you update or delete a document in a way that would remove it from the view, than it will
be removed from the result of this hook.

If a design document isn't replicated yet, useView will error. But once it did sync, useView will query it.
Same when the design document did change. Whenever it changes, useView will re-query.

Read more about views in [CouchDB's Guide to Views](https://docs.couchdb.org/en/stable/ddocs/views/index.html).

`useView` can only be invoked from a component nested inside of a [`<Provider />`](./provider.md).

> `useView` requires [`pouchdb-mapreduce`](https://www.npmjs.com/package/pouchdb-mapreduce) to be
> installed and setup. If you use the [`pouchdb`](https://www.npmjs.com/package/pouchdb) or
> [`pouchdb-browser`](https://www.npmjs.com/package/pouchdb-browser) packages, it is already setup.
>
> `pouchdb-mapreduce` uses the `Function` constructor. If your Javascript-environment doesn't allow
> `eval`, then you can't use `useView`!

## Parameters

`useView` has the same options as [`db.query()`](https://pouchdb.com/api.html#query_database). Options
descriptions are copied from the PouchDB API page.

1. `fun: string | PouchDB.Map` - Map/reduce function, which can be one of the following:
   - The name of a view in an existing design document. It can be `'designDocName/viewName'` or `'viewName'` as a
     shorthand for `'viewName/viewName'`.
   - A map function. **Danger! It will scan the _entire database_ every time a parameter or document did change!
     Use only for development!**
   - A full CouchDB-style map/reduce view `{map: ..., reduce: ...}`. **Danger! It will scan the _entire database_
     every time a parameter or document did change! Use only for development!**
2. `options?: object` - An options object. It has the same options as
   [`db.query()`](https://pouchdb.com/api.html#query_database).
   - `options.reduce?: boolean` - Should the result be reduced by the defined `reduce` function? Defaults to `true`.
     - `true` - Return the result of the reduce function.
     - `false` - Don't use the reduce function.
     - It gets ignored if no reduce function is defined in the view.
   - `options.include_docs?: boolean` - Include the document in each row in the `doc` field.
   - `options.conflicts?: boolean` - If `options.include_docs` is `true`, include conflicts in the `_conflicts`
     field of a doc.
   - `options.attachments?: boolean` - If `options.include_docs` is `true`, include attachment data as
     base64-encoded string.
   - `options.binary?: boolean` - If `options.include_docs` and `options.attachments` are `true`, return attachment
     data as Blobs, instead of as base64-encoded strings.
   - `options.startkey?: any` - Get documents with IDs in a certain range. The range starts with this key.
   - `options.endkey?: any` - Get documents with IDs in a certain range. The range ends with this key.
   - `options.inclusive_end?: boolean` - Include rows having a key equal to the given `options.endkey`. Default is
     `true`.
   - `options.limit?: number` - Maximum number of rows to return.
   - `options.skip?: number` - Number of rows to skip before returning (warning: poor performance).
   - `options.descending?: boolean` - Reverse the order of the output rows. Also revers `options.startkey` and
     `options.endkey`!
   - `options.key?: any` - Only return rows matching this key.
   - `options.keys?: any[]` - Array of keys to fetch in a single shout.
     - Neither `options.startkey` nor `options.endkey` can be specified with this option.
     - The rows are returned in the same order as the supplied `keys` array.
     - The row for a deleted document will have the revision ID of the deletion, and an extra key `"deleted": true`
       in the `value` property.
     - The row for a nonexistent document will only contain an `"error"` property with the value `"not_found"`.
   - `options.group?: boolean` - True if you want the reduce function to group results by keys, rather than
     returning a single result. Defaults to `false`.
   - `options.group_level?: number` - Number of elements in a key to group by, assuming the keys are arrays.
     Defaults to the full length of the array.
   - `options.stale?: 'ok' | 'update_after'` - Only applies to saved views. Can be one of:
     - unspecified (default): Returns the latest results, waiting for the view to build if necessary.
     - `'ok' | 'update_after'`: Returns results immediately, even if they’re out-of-date.
       But starts a new request after the first request did resolved.
   - `options.update_seq?: boolean` - Include an `update_seq` value indicating which sequence id of the underlying
     database the view reflects.
   - `options.db?: string` - Selects the database to be used. The database is selected by it's name/key.
     The special key `"_default"` selects the _default database_. Defaults to `"_default"`.

> `startkey`, `endkey`, `key` and `keys` are check for equality with a deep equal algorithm.
> And only if they differentiate by _value_ will they cause a new query be made.

## Result

`useView` results an object with those fields:

- `rows: object[]` - Array of objects that contain the requested information. Empty during the first fetch or
  during an error. Each object has following fields:
  - `id?: string` - `_id` of the document from which the row was mapped. If reduced this is not defined.
  - `key: any | null` - Key that was the first argument passed to `emit` in the `map` function.
  - `value: any` - Value of the row.
    - If no reduce was done: Value that was the second argument passed to `emit` in the `map` function.
    - Else: Result of the reduce function.
  - `doc?: PouchDB.Core.Document` - If `options.include_docs` was `true`, this field will contain the document. And
    if `attachments` is also `true`, the document will contain the attachment data in the `"_attachments"` field.
- `offset?: number` - The `skip` provided.
- `total_rows?: number` - The total number of non-deleted documents in the database.
- `update_seq?: number | string` - If `update_seq` is `true`, this will contain the sequence id of the underlying
  database.
- `state: 'loading' | 'done' | 'error'` - Current state of the hook.
  - `loading` - It is loading the documents. Or it is loading the updated version of them.
  - `done` - The documents are loaded, and no update is being loaded.
  - `error` - There was an error with fetching the documents. Look into the `error` field.
- `loading: boolean` - It is loading. The state is `loading`. This is only a shorthand.
- `error: PouchDB.Error | null` - If there was an error, then this field will contain the error. The error is reset
  to `null` once a fetch was successful.

## Example Usage

`useView` is for more complex secondary indexes and statistics.

### Find by tags

If you use a tag system and want to list all documents with a tag, then use `useView`.

```javascript
var designDoc = {
  _id: '_design/app',
  views: {
    tags: {
      map: function tagsMap(doc) {
        if (isArray(doc.tags)) {
          doc.tags.forEach(function (tag) {
            // emit tag as the key and the doc title as the value
            emit(tag, doc.title)
          })
        }
      }.toString(),
      reduce: '_count',
    },
  },
}
```

```jsx
import React from 'react'
import { useView } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function ListAllOfTag({ tag }) {
  const { rows, loading, error } = useView('app/tags', {
    key: tag,
    reduce: false, // don't reduce
  })

  if (loading && rows.length === 0) {
    return <div>loading ...</div>
  }

  if (error) {
    return <ErrorMessage error={error}>
  }

  return (
    <ul>
      {rows.map(row => ( // row.key is the tag and row.id is the _id of the document.
        <li key={`${row.key} ${row.id}`}>{row.value}</li>
      ))}
    </ul>
  )
}
```

### Get statistics

You can count things, or get other statistics.

This example counts the number of documents with a tag.

```javascript
var designDoc = {
  _id: '_design/app',
  views: {
    tags: {
      map: function tagsMap(doc) {
        if (isArray(doc.tags)) {
          doc.tags.forEach(function (tag) {
            // emit tag as the key and the doc title as the value
            emit(tag, doc.title)
          })
        }
      }.toString(),
      reduce: '_count',
    },
  },
}
```

```jsx
import React from 'react'
import { useView } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function ListAllTags() {
  const { rows, loading, error } = useView('app/tags', {
    group: true,
    // reduce: true // do reduce
  })

  if (loading && rows.length === 0) {
    return <div>loading ...</div>
  }

  if (error) {
    return <ErrorMessage error={error}>
  }

  return (
    <ul>
      {rows.map(row => (
        <li key={row.key}>
          Tag <strong>{row.key}</strong> - Number of documents: {row.value}
        </li>
      ))}
    </ul>
  )
}
```

### Booking statistics

You can count values together.

In this example you can sum the changes to a bank account in a time frame.

```javascript
var designDoc = {
  _id: '_design/accounting',
  views: {
    change: {
      map: function accountChangeMap(doc) {
        // only if it is the correct doc type
        if (doc.type === 'booking') {
          var time = new Date(doc.timestamp)

          // use a complex key. Here an array
          emit(
            [
              time.getUTCFullYear(),
              time.getUTCMonth() + 1,
              time.getUTCDate(),
              time.getUTCHours(),
              time.getUTCMinutes(),
              time.getUTCSeconds(),
            ],
            doc.amount
          )
        }
      }.toString(),
      reduce: '_sum',
    },
  },
}
```

```jsx
import React from 'react'
import { useView } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function BankAccountChange({ year }) {
  const { rows, loading, error } = useView('accounting/change', {
    group_level: 1, // sum together all keys with the same year
    startkey: [year],
    // objects are sorted last:
    // https://docs.couchdb.org/en/stable/ddocs/views/collation.html#collation-specification
    endkey: [year, {}],
    // reduce: true // do reduce
  })

  if (loading && rows.length === 0) {
    return <div>loading ...</div>
  }

  if (error) {
    return <ErrorMessage error={error}>
  }

  return (
    <p>
      Your account did change {rows[0].value}€ in {year}.
    </p>
  )
}
```

### Select a database

```javascript
var designDoc = {
  _id: '_design/app',
  views: {
    tags: {
      map: function tagsMap(doc) {
        if (isArray(doc.tags)) {
          doc.tags.forEach(function (tag) {
            // emit tag as the key and the doc title as the value
            emit(tag, doc.title)
          })
        }
      }.toString(),
      reduce: '_count',
    },
  },
}
```

```jsx
import React from 'react'
import { useView } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function ListAllOfTag({ tag, isLocalReady }) {
  const { rows, loading, error } = useView('app/tags', {
    key: tag,
    reduce: false, // don't reduce
    // Select the database used
    db: isLocalReady ? 'local' : 'remote'
  })

  if (loading && rows.length === 0) {
    return <div>loading ...</div>
  }

  if (error) {
    return <ErrorMessage error={error}>
  }

  return (
    <ul>
      {rows.map(row => ( // row.key is the tag and row.id is the _id of the document.
        <li key={`${row.key} ${row.id}`}>{row.value}</li>
      ))}
    </ul>
  )
}
```
