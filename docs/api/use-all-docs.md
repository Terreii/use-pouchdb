---
id: use-all-docs
title: useAllDocs
---

## Overview

`useAllDocs` is the hook version of [`db.allDocs()`](https://pouchdb.com/api.html#batch_fetch). It gives you the
ability to fetch multiple documents by their ids.

It doesn't need the creation of a secondary index. This means that it is useable right away, even when not all
documents did sync.

As all hooks, it subscribes to updates.

`useAllDocs` can only be invoked from a component nested inside of a `<Provider />`.

## Parameters

`useAllDocs` expects a single options object. It has the same options as
[`db.allDocs()`](https://pouchdb.com/api.html#batch_fetch). Options descriptions are copied from the PouchDB API
page.

1. `options: object` - [`db.allDocs()`](https://pouchdb.com/api.html#batch_fetch) option object.
   - `options.include_docs?: boolean` - Include the document itself in each row in the `doc` field. Otherwise by
     default you can only get the `_id` and `_rev` properties.
   - `options.conflicts?: boolean` - Include conflict information in the `_conflicts` field of a doc.
   - `options.attachments?: boolean` - Include attachment data as base64-encoded string.
   - `options.binary?: boolean` - Return attachment data as Blobs, instead of as base64-encoded strings.
   - `options.startkey?: string` - Get documents with IDs in a certain range. The range starts with this key.
   - `options.endkey?: string` - Get documents with IDs in a certain range. The range ends with this key.
   - `options.inclusive_end?: boolean` - Include documents having an ID equal to the given `options.endkey`.
     Default is `true`.
   - `options.limit?: number` - Maximum number of documents to return.
   - `options.skip?: number` - Number of documents to skip before returning (warning: poor performance!).
   - `options.descending?: boolean` - Reverse the order of the output documents. Note that the order of
     `options.startkey` and `options.endkey` is reversed when `descending` is `true`.
   - `options.key?: string` - Only return documents with IDs matching this string key.
   - `options.keys?: string[]` - Fetch multiple known IDs in a single shot.
     - Neither `options.startkey` nor `options.endkey` can be specified with this option.
     - The rows are returned in the same order as in the supplied `keys` array.
     - The row for a deleted document will have the revision ID of the deletion, and an extra key `deleted: true`
       in the `value` property.
     - The row for a nonexistent document will just contain an `error` property with the value `"not_found"`.
     - For more details, see the [`db.allDocs() documentation`](https://pouchdb.com/api.html#batch_fetch) or the
       [CouchDB query options documentation](https://docs.couchdb.org/en/stable/api/ddoc/views.html#db-design-design-doc-view-view-name).
   - `options.update_seq?: boolean` - Include an `update_seq` value indicating which sequence id of the underlying
     database the view reflects.

## Result

`useAllDocs` results an object with those fields:

- `rows: object[]` - Array of objects that contain the requested information. Empty during the first fetch or
  during an error. Each object has following fields:
  - `id: string` - `_id` of the document.
  - `key: string` - `_id` of the document.
  - `value: object` - Object with one field:
    - `value.rev: string` - `_rev` of the document.
  - `doc?: PouchDB.Core.Document` - If `options.include_docs` was `true`, this field will contain the document. And
    if `attachments` is also `true`, the document will contain the attachment data in the `"_attachments"` field.
- `offset: number` - The `skip` provided.
- `total_rows: number` - The total number of non-deleted documents in the database.
- `update_seq?: number | string` - If `update_seq` is `true`, this will contain the sequence id of the underlying
  database.
- `state: 'loading' | 'done' | 'error'` - Current state of the hook.
  - `loading` - It is loading the documents. Or it is loading the updated version of them.
  - `done` - The documents are loaded, and no update is being loaded.
  - `error` - There was an error with fetching the documents. Look into the `error` field.
- `loading: boolean` - It is loading. The state is `loading`. This is just a shorthand.
- `error: PouchDB.Error | null` - If there was an error, then this field will contain the error. The error is reset
  to `null` once a fetch was successful.

## Example Usage

`useAllDocs` is useful for many operations where you need to load multiple documents.

### Prefix search

If you sort your documents by `_id`, then you can use `useAllDocs` to load all documents with a prefix. Read more
at the [12 pro tips](https://pouchdb.com/2014/06/17/12-pro-tips-for-better-code-with-pouchdb.html) section 7.

The `'\ufff0'` is a special high Unicode character, that is sorted after most others.

If a document, that fall into this range, gets added, updated or deleted, then the `rows` will be updated
accordingly.

```jsx
import React from 'react'
import { useAllDocs } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function Comments({ id }) {
  const commentsPrefix = `comments_${id}`
  const { rows, loading, state, error } = useAllDocs({
    startkey: commentsPrefix,
    endkey: commentsPrefix + '\ufff0',
    include_docs: true,
  })

  if (state === 'error') {
    return <ErrorMessage error={error} />
  }

  if (loading && rows.length === 0) {
    return null
  }

  return (
    <div>
      <h4>Comments</h4>

      <div>
        {rows.map(row => (
          <section key={row.id}>
            <h5>{row.doc.username} commented</h5>
            {!row.value.rev.startsWith('1-') && <span>Edited</span>}
            <p>{row.doc.comment}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
```

### Load multiple documents by id

`useAllDocs` can also load multiple documents by their IDs.

```jsx
import React from 'react'
import { useAllDocs } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function Related({ doc }) {
  const { rows, loading, state, error } = useAllDocs({
    keys: doc.related || [],
    include_docs: true,
  })

  if (state === 'error') {
    return <ErrorMessage error={error} />
  }

  if (loading && rows.length === 0) {
    return null
  }

  return (
    <div>
      <h4>Read more</h4>

      <ul>
        {rows.map(row => (
          <li key={row.id}>{row.doc.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

### Descending

It is imported to remember that `options.startkey` and `options.endkey` switch, when `options.descending` is `true`.

```jsx
import React from 'react'
import { useAllDocs } from 'use-pouchdb'
import ms from 'milliseconds'
import { ErrorMessage } from './ErrorMessage'

export function LastBookings() {
  const now = new Date()

  // this goes from now to 7 days ago.
  const { rows, loading, state, error } = useAllDocs({
    // start now
    startkey: 'bookings_' + now.toJSON(),
    // End at endkey
    // the date 7 days ago is the end.
    endkey: 'bookings_' + new Date(now.getTime() - ms.days(7)).toJSON(),
    include_docs: true,
    descending: true,
  })

  if (state === 'error') {
    return <ErrorMessage error={error} />
  }

  if (loading && rows.length === 0) {
    return null
  }

  return (
    <div>
      <h4>Bookings</h4>

      <ul>
        {rows.map(row => (
          <li key={row.id}>
            {row.doc.amount}€ from {row.doc.partner}
          </li>
        ))}
      </ul>
    </div>
  )
}
```
