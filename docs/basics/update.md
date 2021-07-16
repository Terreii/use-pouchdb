---
id: update
title: Update docs
---

Up until now we don't have any way to update our docs, i.e. mark our todos as done.

## Todo component updates the doc

Updating will be the job of our updated `<Todo />` component:

```jsx
// Todo.js
import React from 'react'
import { usePouch } from 'use-pouchdb'

export default function Todo({ todo }) {
  const db = usePouch()

  const update = async () => {
    const doc = await db.get(todo._id)

    // check if the UI state matches the state in the database.
    if (doc.done === todo.done) {
      doc.done = !doc.done // Update the doc.

      try {
        await db.put(doc) // And put the new version into the database.
      } catch (err) {
        if (err.name === 'conflict') {
          update() // There was a conflict, try again.
        } else {
          console.error(err) // Handle other errors.
        }
      }
    }
  }

  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} onChange={update} />

      <span className={'todo-item__text' + (todo.done ? ' done' : '')}>
        {todo.text}
      </span>
    </li>
  )
}
```

Right away you might see some familiar functions, like [`usePouch`](../api/use-pouch.md) and
`db.put()`. But also the new `db.get()`.

[`db.get()`](https://pouchdb.com/api.html#fetch_document) fetches a single document. All it needs is the _id_ of
the doc. Like most methods of PouchDB, it too can fail. For example, if the doc doesn't exist, or you don't have
access to the database.

> The hook for fetching and subscribing to a single document is [`useDoc`](../api/use-doc.md).

In `update` we first _load_ the document from the database. Then we _check_ if the doc matches the UI state. And if
it does, we _update_ the `done` field and _put_ the new version into the database. If the update fails with a
`conflict` we _try again_.

That seems a little bit of an over engineered example. But remember PouchDB is a _distributed_ system.

[`useAllDocs`](../api/use-all-docs.md) takes some time between receiving a change update and
re-rendering a component. In this time-frame the user could have clicked. If the document did
update, so that `done` has already the desired value, there is no need in updating the document
again. It would only add in used disk space and network traffic. Which the added bonus of
potential conflicts. Better check if we even need to update the doc.

`db.get()` and `db.put()` also take their time. And if in this time-frame another change did sync, we get a
conflict! A conflict that throws right away: an [immediate conflict](https://pouchdb.com/guides/conflicts.html).

In this example we've chosen to handle the immediate conflict by trying again. We run `update` again, with
it still having a reverence to the old todo. It'll `get` the new version of the document, check if `done` has the
desired value, and update the new doc only if not.

Ok, yes. Those two conflict examples are _extremely_ unlikely. In _this_ example, you would probably be save
without error-handling. But in a typical app, you don't know how long something takes. What caching happens
between your data source and your update component. Those examples are there to guide you to the best
practice of PouchDB.

> This dance of conflict resolution is what allows PouchDB to sync! It requires you to handle conflicts.
>
> In this example we know what the desired state of a doc should be: The last user interaction. There is also
> almost no data lost if that assumption is wrong.
>
> But you should generally follow the role: **"Last write wins" means _losing_ your users data!**

> There are two types of conflicts: **immediate conflicts** and **eventual conflicts**. You can read more about
> them in the [PouchDB Conflicts guide](https://pouchdb.com/guides/conflicts.html).

## TodoList filters the Todos

Now that we can update todos. Let's filter them!

First using the clearer, but naïve way:

### The naïve way

Update `<TodoList />` to be similar to this:

```jsx
// TodoList.js
import React, { useState, useMemo } from 'react'
import { useAllDocs } from 'use-pouchdb'
import Todo from './Todo'
import VisibilityFilters from './VisibilityFilters'

const filters = {
  all: 'all',
  completed: 'completed',
  incomplete: 'incomplete',
}

export default function TodoList() {
  const { rows, loading } = useAllDocs({
    include_docs: true, // Load all document bodies
  })

  const [filter, setFilter] = useState(filters.all)

  const todos = useMemo(() => {
    switch (filter) {
      case filters.completed:
        return rows.filter(row => row.doc.done)

      case filters.incomplete:
        return rows.filter(row => !row.doc.done)

      case filters.all:
      default:
        return rows
    }
  }, [rows, filter])

  return (
    <>
      <ul className="todo-list">
        {(todos && todos.length) || loading
          ? todos.map(todo => <Todo key={todo.key} todo={todo.doc} />)
          : 'No todos, yay!'}
      </ul>

      <VisibilityFilters
        current={filter}
        options={filters}
        onChange={setFilter}
      />
    </>
  )
}
```

And the `<VisibilityFilters />` component:

```jsx
// VisibilityFilters.js
import React from 'react'

export default function VisibilityFilters({ current, options, onChange }) {
  return (
    <div className="visibility-filters">
      {Object.entries(options).map(([key, value]) => (
        <label key={key}>
          <input
            type="radio"
            name="visibility-filters"
            value={value}
            checked={value === current}
            onChange={() => {
              onChange(value)
            }}
          />
          <span>{value}</span>
        </label>
      ))}
    </div>
  )
}
```

That would be all. We now can filter todos! Show all or by completion state.

But there is one more thing! Open another tab (or better: a new window) with our Todo-App.

If you are not in private browsing all your todos should already be there! Now update them.

![Disney Marvel's Loki says "Oh yes"](../../img/oh_yes_indeed.gif)

Your todos sync between your tabs, while the filter state is local!

### The better way

But what are we doing! We fetch _all_ documents and then manually filter them! And there is also a
**bug** in it! When we add another document _type_, then they will be shown, too!

But PouchDB is a database after all! And a databases job is to index our data!
Well, it can, and PouchDB has two ways to build secondary indexes.
We will be using the newer [Mango queries](https://pouchdb.com/guides/mango-queries.html).

The hook for Mango queries is [`useFind`](../api/use-find.md)
(I really wanted to name it `useMango` but ...).

`useFind` is a combination of the two PouchDB methods
[`db.find()`](https://pouchdb.com/api.html#query_index) and
[`db.createIndex()`](https://pouchdb.com/api.html#create_index).
It can optionally check if an index exist and create it if needed.

But `useFind` requires a plugin: [`pouchdb-find`](https://www.npmjs.com/package/pouchdb-find).

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D pouchdb-find
```

<!--yarn-->

```sh
yarn add -D pouchdb-find
```

<!--END_DOCUSAURUS_CODE_TABS-->

Next add `pouchdb-find` to PouchDB in `App.js`:

```jsx
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import { Provider } from 'use-pouchdb'

import AddTodo from './AddTodo'
import TodoList from './TodoList'

PouchDB.plugin(PouchDBFind) // Add pouchdb-find as a plugin

export default function App() {
  ...
```

After that, we can update `<TodoList />` to use Mango queries:

```jsx
// TodoList.js
import React, { useState } from 'react'
import { useFind } from 'use-pouchdb'
import Todo from './Todo'
import VisibilityFilters from './VisibilityFilters'

const filters = {
  all: 'all',
  completed: 'completed',
  incomplete: 'incomplete',
}

export default function TodoList() {
  const [filter, setFilter] = useState(filters.all)
  const { docs: todos, loading } = useFind(
    filter === filters.all
      ? {
          // Create and query an index for all Todos
          index: {
            fields: ['type'],
          },
          selector: {
            type: 'todo',
          },
        }
      : {
          // Create and query an index for all Todos, sorted by their done state
          index: {
            fields: ['type', 'done'],
          },
          selector: {
            type: 'todo',
            done: filter === filters.completed,
          },
        }
  )

  // todos is now an array of the documents. You must use their _id field directly!
  return (
    <>
      <ul className="todo-list">
        {(todos && todos.length) || loading
          ? todos.map(todo => <Todo key={todo._id} todo={todo} />)
          : 'No todos, yay!'}
      </ul>

      <VisibilityFilters
        current={filter}
        options={filters}
        onChange={setFilter}
      />
    </>
  )
}
```

We pass to `useFind` two sets of options.

When `filter` is set to `all`:

```json
{
  "index": {
    "fields": ["type"]
  },
  "selector": {
    "type": "todo"
  }
}
```

This will create an index sorted by the `type` field of a document.
And the fetch all documents that have a `type` field with the value of `"todo"`.

The `index` object creates the index. Its `fields` array describes which field should be indexed.
The [order matters](https://pouchdb.com/guides/mango-queries.html#more-than-one-field).

The `selector` object passes a description of the Objects to fetch.
It uses the [Mango Query-language](https://docs.couchdb.org/en/stable/api/database/find.html#selector-syntax).
Here we request every document that has a `type` field with the value `"todo"`.

The other option is for filtered todos:

```javascript
{
  "index": {
    "fields": ["type", "done"]
  },
  "selector": {
    "type": "todo",
    "done": filter === filters.completed
  }
}
```

This will create an index where the documents are sorted first by their `type` field,
and then their `done` fields.

We then dynamically pass the value for the `done` field into the `selector` object.

Mango queries return by default max 25 docs. If you want more, then you must pass `"limit": 50`
to `useFind`:

```javascript
useFind({
  index: {
    fields: ['type'],
  },
  selector: {
    type: 'todo',
  },
  limit: 50, // or more or what you need.
})
```

> PouchDB's secondary indexes are **lazy**.
>
> Most Databases will update all indexes whenever data is _updated_.
> But PouchDB will only update an index when that index is _queried!_
> It knows what did change and only update those documents.
>
> The drawback is that if a user didn't use an index for a while, the query will take a while.
> But if a user never uses an index, then they never pay the update cost for that index.

Now our filter is performant and correct! And our data is still synced between tabs!

Next: we going to implement syncing between different browsers/devices.
