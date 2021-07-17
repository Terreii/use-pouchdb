---
id: add-todo
title: Add Todos
---

Let's work on `<AddTodo />` next. It will add a new Todo to the database. Therefore, it needs access to the
database. We are going to use the [`usePouch`](../api/use-pouch.md) hook for this.

```jsx
// AddTodo.js
import React, { useState } from 'react'
import { usePouch } from 'use-pouchdb'

export default function AddTodo() {
  const db = usePouch() // get the database

  const [input, setInput] = useState('')

  const handleAddTodo = async event => {
    event.preventDefault()

    const doc = {
      _id: new Date().toJSON(), // give the document a unique id
      type: 'todo',
      text: input,
      done: false,
    }

    await db.put(doc) // put the new document into the database

    setInput('')
  }

  return (
    <form onSubmit={handleAddTodo}>
      <input
        type="text"
        value={input}
        minLength="1"
        onChange={event => {
          setInput(event.target.value)
        }}
      />

      <button>Add Todo</button>
    </form>
  )
}
```

Let's go through this component:

First we get a reference to the database with `usePouch()`. It is the database we provided to
[`<Provider />`](../api/provider.md) in the last section.

The next instruction is the [`useState`](https://reactjs.org/docs/hooks-reference.html#usestate) hook, to store
what the user did enter.

We'll jump over the `handleAddTodo` callback. And go to the JSX return:

We use a `<form>` element with an onSubmit event listener to add the todo, whenever the user presses
enter/return/submit or clicks the `<button>`. It will also only submit when the input has a length of
1 or more `minlength='1'` (Isn't HTML awesome?).

When the user does submit, we handle the event in `handleAddTodo`. The `doc` object is our **Todo-Document**, which
we will add to the database. It's going be something like this:

```json
{
  "_id": "2020-05-25T21:42:17.275Z",
  "type": "todo",
  "text": "my first document!",
  "done": false
}
```

Let's brake it down:

**`_id`**

The `_id` is the unique identifier of a document. It must be unique to it's database. We can use the **id** later
to retrieve the document. Besides that, we can use it to sort documents and other tricks.

**`type`**

The `type` field is technically not needed. It is a PouchDB and CouchDB convention to differentiate between
document types. Like `type` in [Redux Actions](https://redux.js.org/basics/actions), but not needed.<br />
You could also store the type in the `_id` as a prefix: `'todo_2020-05-25T21:42:17.275Z'`. That is how the
[Relational Pouch](https://github.com/pouchdb-community/relational-pouch) plugin
[does it](https://github.com/pouchdb-community/relational-pouch#how-does-it-work).

**`text`** and **`done`**

They are our todo-data. The text and if it's done.

Next `await db.put(doc)`. Here we put the document into the database (db). `put()` returns a Promise. The Promise
only resolves once the document was successfully put into the database. If it's resolves the data is save.

**`put()` can fail**! There are multiple reasons: The database could be _destroyed_, you _don't have access_ to it,
or there is already _a document with the same `_id`_. But, because we store the document on a local database and
with an `_id` that is the current time with milliseconds, it is unlikely, but still possible.

`setInput('')` resets the `<input />`.

If `put()` fails, the todo will not be added and the `<input />` not reset. The user could then try again.

> Normally you should _always_ catch and handle a write/update error. PouchDB is a _distributed_ system after all.
>
> Displaying an error message or trying again (with a different id) would be enough for this use case.

Add `AddTodo.js` to `App.js`:

```jsx
import React, { useState, useEffect } from 'react'
import './App.css'

import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

import AddTodo from './AddTodo'

...
  return (
    <Provider pouchdb={db}>
      <div className="App">
        <AddTodo />
      </div>
    </Provider>
  )
```

That's it! We can now add Todos to the database! 🎉

Next up: list them!
