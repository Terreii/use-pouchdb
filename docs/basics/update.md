---
id: update
title: Update docs
---

Up until now we don't have any way to update our docs, i.e. mark our todos as done.

Updating will be the job of our `<Todo />` component:

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

Right way you might see some familiar functions, like `usePouch` and `db.put()`. But also the new `db.get()`.

[`db.get()`](https://pouchdb.com/api.html#fetch_document) fetches a single document. All it needs is the _id_ of the doc. Like most methods of PouchDB, it too can fail. For example, if the doc doesn't exist, or you don't have access to the database.

> The hook for fetching and subscribing to a single document is `useDoc`.

In `update` we first _load_ the document from the database. Then we _check_ if the doc matches the UI state. And if it does, we _update_ the `done` field and _put_ the new version into the database. If the update fails with a `conflict` we _try again_.

That seems a little bit of an over engineered example. But remember PouchDB is a _distributed_ system.

`useAllDocs` takes some time between receiving a change update and re-rendering a component. In this time-frame the user could have clicked. If the document did update, so that `done` has already the desired value, there is no need in updating the document again. It would only add in used disk space and network traffic. Which the added bonus of potential conflicts. Better check if we even need to update the doc.

`db.get()` and `db.put()` also take their time. And if in this time-frame another change did sync, we get a conflict! A conflict that throws right away: an [immediate conflict](https://pouchdb.com/guides/conflicts.html).

In this example we've chosen to handle the immediate conflict by simply trying again. We run `update` again, with it still having a reverence to the old todo. It'll `get` the new version of the document, check if `done` is desired value, and update the new doc only if not.

> This dance of conflict resolution is what allows PouchDB to sync! It requires you to handle conflicts.
>
> In this example we know what the desired state of a doc should be: The last user interaction. There is also almost no data lost if that assumption is wrong.

> There are two types of conflicts: **immediate conflicts** and **eventual conflicts**. You can read more about them in the [PouchDB Conflicts guide](https://pouchdb.com/guides/conflicts.html).

Now that we can update todos. Let's filter them!

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
            onClick={e => {
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

Next: we going to implement syncing between different browsers/devices.
