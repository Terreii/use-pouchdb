---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: default
title: usePouchDB - Access PouchDB in React Components
---

# Access PouchDB in React Components

usePouchDB is a collection of [Reacts Hooks](https://reactjs.org/docs/hooks-intro.html "Introducing Hooks on reactjs.org") to access [PouchDB](https://pouchdb.com/), the *offline-first*, javascript database, directly from your components.

```jsx
import React from 'react'
import { useDoc } from 'use-pouchdb'
import ReactMarkdown from 'react-markdown'

export default function BlogPost ({ id }) {
  // Access a document and subscribe to updates to it.
  const { doc, isLoading, error } = useDoc(id)

  if (isLoading && doc == null) {
    return (
      <p>
        <em>loading...</em>
      </p>
    )
  }

  if (error) {
    return (
      <p>
        <strong>
          {error.status} - {error.message}
        </strong>
      </p>
    )
  }

  const published = new Date(doc.publish_date)

  return (
    <article>
      <h2>{doc.title}</h2>
      <time dateTime={published.toISOString()}>
        {published.toLocalString()}
      </time>

      <ReactMarkdown source={doc.text} />
    </article>
  )
}
```
