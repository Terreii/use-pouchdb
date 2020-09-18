---
id: use-doc
title: useDoc
---

## Overview

To read a single document use `useDoc`. It is the hook version of
[`db.get()`](https://pouchdb.com/api.html#fetch_document). It also subscripts to updates of that document.

`useDoc` can only be invoked from a component nested inside of a `<Provider />`.

## Parameters

`useDoc` has the same options as [`db.get()`](https://pouchdb.com/api.html#fetch_document), with the only exception
of `options.open_revs`. Options descriptions are copied from the PouchDB API page.

1. `id: string` - \_id of the document.
2. `options?: object | null` - [`db.get()`](https://pouchdb.com/api.html#fetch_document) option object. All options
   except `options.open_revs` are allowed.
   - `options.rev?: string` - If set: fetch specific revision of a document. It defaults to winning revision.
   - `options.revs?: boolean` - Include revision history of the document.
   - `options.revs_info?: boolean` - Include a list of revisions of the document, and their availability.
   - `options.conflicts?: boolean` - If specified, conflicting leaf revisions will be attached in `_conflicts`
     array.
   - `options.attachments?: boolean` - Include attachment data.
   - `options.binary?: boolean` - Only evaluated when `attachments` is `true`. Return attachment data as
     Blobs/Buffers, instead of as base64-encoded strings.
   - `options.latest?: boolean` - Forces retrieving latest "leaf" revision, no matter what rev was requested.
   - `options.db?: string` - Selects the database to be used. The database is selected by it's name/key.
     The special key `"_default"` selects the _default database_. Defaults to `"_default"`.
3. `initialValue?: Object | function` - Optional initial value of `doc` result. Has the same behavior as
   `useState`'s initialValue. If used then the `options` object must be set.

## Result

`useDoc` results an object with those fields:

- `doc: PouchDB.Core.Document | null` - The requested document. If there is an error, or its still loading the doc
  is `null` or the `initialValue`.
- `state: 'loading' | 'done' | 'error'` - Current state of the hook.
  - `loading` - It is loading the document. Or it is loading the updated version of it.
  - `done` - The document was loaded, and no update is being loaded.
  - `error` - There was an error with fetching the document. Look into the `error` field.
- `loading: boolean` - It is loading. The state is `loading`. This is only a shorthand.
- `error: PouchDB.Error | null` - If there was an error, then this field will contain the error. The error is reset
  to `null` once a document was successfully loaded.

## Example Usage

`useDoc` is for the use case of reading one document.

### Getting a document

```jsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { useDoc } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function PostViewer({ id }) {
  const { doc, loading, state, error } = useDoc(id)

  if (state === 'error') {
    return <ErrorMessage error={error} />
  }

  if (loading && doc == null) {
    return (
      <article>
        <hgroup>
          <h1>loading ...</h1>
        </hgroup>
      </article>
    )
  }

  return (
    <article>
      <hgroup>
        <h1>{doc.title}</h1>
        <h2>by {doc.author}</h2>
      </hgroup>
      <ReactMarkdown source={doc.text} />
    </article>
  )
}
```

### Options

```jsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { useDoc } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

import { DocRenderer } from './DocRenderer'

export function ConflictResolver({ id }) {
  const { doc: winning, loading: winningIsLoading } = useDoc(id, {
    conflicts: true,
  })

  const { doc: loosing, loading: loosingIsLoading } = useDoc(id, {
    rev: winning._conflict.length > 0 ? winning._conflict[0] : undefined,
  })

  if (winningIsLoading || loosingIsLoading) {
    return <div>loading ...</div>
  }

  return (
    <div>
      <DocRenderer doc={winning} />
      <DocRenderer doc={loosing} />
    </div>
  )
}
```

### With initial value

If the `initialValue` is set, then the `options` must also be set (it can be an `object` or `null`).

```jsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { useDoc } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function PostViewer({ id }) {
  const { doc, state, error } = useDoc(id, null, () => ({
    _id: id,
    title: '...',
    author: '...',
    text: 'loading ...',
  }))

  if (state === 'error') {
    return <ErrorMessage error={error} />
  }

  return (
    <article>
      <hgroup>
        <h1>{doc.title}</h1>
        <h2>by {doc.author}</h2>
      </hgroup>
      <ReactMarkdown source={doc.text} />
    </article>
  )
}
```

The `initialValue` can also be used for a blue print of documents. If no doc was fount, use the
initial value and edit it. Once it is saved, the `useDoc` will re-fetch the doc.

### Select a database

```jsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { useDoc } from 'use-pouchdb'
import { ErrorMessage } from './ErrorMessage'

export function PostViewer({ id, isLocalReady }) {
  const { doc, loading, state, error } = useDoc(id, {
    db: isLocalReady ? 'local' : 'remote',
  })

  if (state === 'error') {
    return <ErrorMessage error={error} />
  }

  if (loading && doc == null) {
    return (
      <article>
        <hgroup>
          <h1>loading ...</h1>
        </hgroup>
      </article>
    )
  }

  return (
    <article>
      <hgroup>
        <h1>{doc.title}</h1>
        <h2>by {doc.author}</h2>
      </hgroup>
      <ReactMarkdown source={doc.text} />
    </article>
  )
}
```
