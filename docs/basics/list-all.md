---
id: list-all
title: List all Todos
---

The `<TodoList />` component is responsible for rendering the list of todos. Therefore, it needs to read data from
the database. With `useAllDocs` we can! It loads all documents.

Out `<Todo />` component takes the todo document as props and displays it.

```jsx
// TodoList.js
import React from 'react'
import { useAllDocs } from 'use-pouchdb'
import Todo from './Todo'

export default function TodoList() {
  const { rows: todos, loading } = useAllDocs({
    include_docs: true, // Load all document bodies
  })

  return (
    <ul className="todo-list">
      {(todos && todos.length) || loading
        ? todos.map(todo => <Todo key={todo.key} todo={todo.doc} />)
        : 'No todos, yay!'}
    </ul>
  )
}
```

`useAllDocs` loads all documents sorted by their _id_. It also subscripts to changes in the database. When ever a
new document will be added, or an existing one updated, `useAllDocs` will refetch all documents. It can also only
load a slice of all documents, but we don't need that here.

The `rows` field will contain an array of objects.

```json
[
  {
    "key": "2020-05-25T21:42:17.275Z",
    "id": "2020-05-25T21:42:17.275Z",
    "value": {
      "rev": "1-1234567890"
    },
    "doc": {
      "_id": "2020-05-25T21:42:17.275Z",
      "_rev": "1-1234567890",
      "type": "todo",
      "text": "my first document!",
      "done": false
    }
  }
]
```

We use the option `include_docs: true` to load all documents in one go. Without it the `doc` field wouldn't exist.

> Yes `key` and `id` are a little bit redundant. But the underlying
> [`db.allDocs`](https://pouchdb.com/api.html#batch_fetch) and
> [`db.query`](https://pouchdb.com/api.html#query_database) (for `useQuery`) share most of their API.

Now to the `<Todo />` component:

```jsx
// Todo.js
import React from 'react'

export default function Todo({ todo }) {
  return (
    <li className="todo-item">
      <span className="todo-item__text">{todo.text}</span>
    </li>
  )
}
```

And with that we have a Todo List! And, whenever you add a new Todo the list will update!

Next we will learn how to update a document!
