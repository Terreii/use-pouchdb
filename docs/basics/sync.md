---
id: sync
title: Syncing
---

Now to Syncing over devices and user accounts.

CouchDB has integrated
[user authentication and authorization](https://docs.couchdb.org/en/stable/intro/security.html)!
We are going to use it, together with the common setup of one database per user, to enable syncing.

You must have added `express-pouchdb` in [basic setup](./setup.md) for this section to work.

## A word about Version 3

With [version 3](https://docs.couchdb.org/en/stable/whatsnew/3.0.html) Apache CouchDB's
settings became more secure. Now every newly created database is _admin only_ by default.
You must change the
[`_security` object](https://docs.couchdb.org/en/stable/api/database/security.html#api-db-security)
of a database, to allow users to access it. This also affects the `_users` database.
Which means, that you need admin rights to create and update users.

Additionally you must change
[a config](https://docs.couchdb.org/en/stable/config/couchdb.html#couchdb/users_db_security_editable)
to be able to change the `_security` document of the `_users` database.
That config will be removed with version 4, though!

_What does that mean for this tutorial?_ This is a beginners guide. We will be using
[PouchDB-Server](https://github.com/pouchdb/pouchdb-server/). At the time of writing,
PouchDB-Server (v4.2) allows everyone to sign up. This does not mean PouchDB-Server is insecure!
It only means that `_users`-database follows the rules listed
[here](https://docs.couchdb.org/en/stable/intro/security.html#authentication-database).

_What does that mean for CouchDB App developers?_ The future is clear: You have to write a small
server (or a bunch of **serverless functions**) for **sign up**, **changing passwords**,
**resetting passwords** and **changing the username**. But CouchDB had already no way of sending
confirmation mails. So you already had to write some logic yourself anyway. Now it is a little bit more.
**Please read [CouchDB's security tutorial](https://docs.couchdb.org/en/stable/intro/security.html)
before you release your app!**

## couch_peruser

A common setup is [couch_peruser](https://docs.couchdb.org/en/stable/config/couch-peruser.html).
With _couch_peruser_ every user has their own, private database. Database names are in the
following form: `userdb-{hex encoded username}`. Or in code:

```javascript
/**
 * Get the name of the users remote-database.
 * This function uses browser APIs.
 * @param {string} name     - The username.
 * @param {string} [prefix] - Prefix, can be changed with config [couch_peruser] database_prefix
 */
function getUserDatabaseName(name, prefix = 'userdb-') {
  const encoder = new TextEncoder()
  const buffy = encoder.encode(name)
  const bytes = Array.from(buffy).map(byte =>
    byte.toString(16).padStart(2, '0')
  )
  return prefix + bytes.join('')
}
```

We will be using couch_peruser.

> [couch_peruser](https://docs.couchdb.org/en/stable/config/couch-peruser.html) became with Apache CouchDB version 3
> a setting. If enabled, CouchDB will create for every user a database, pre-configured for their access!
>
> But couch_peruser was before version 3 possible, you just had to do everything yourself.
>
> If you don't setup an admin in PouchDB-Server, then everyone is admin (called **admin-party**)! Which allows the
> client PouchDB to create the user-database.

## Basics

First some basics about sessions in CouchDB and PouchDB-Server.

### Access a remote Database

To access a remote database, create a new instance of PouchDB with a url-string as the name:

```javascript
const remoteDB = new PouchDB(
  `http://127.0.0.1:5984/${getUserDatabaseName(username)}`,
  { skip_setup: true }
)

// Or if you already know the username and password:
// const remoteDB = new PouchDB(
//   `http://127.0.0.1:5984/${getUserDatabaseName(username)}`,
//   {
//     auth: {
//       username: username,
//       password: password
//     }
//   }
// )
```

The `skip_setup: true` is only imported when we didn't login in yet.

### Sign up

To [sign up a new user you `put`](https://docs.couchdb.org/en/stable/intro/security.html#creating-a-new-user) a new
[user document](https://docs.couchdb.org/en/stable/intro/security.html#users-documents) to the `_users` database.

```javascript
// This example uses CouchDB's HTTP API
const response = await fetch(
  `https://couchdb.example.com/_users/org.couchdb.user:${username}`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: username,
      password: password, // will be hashed by CouchDB. Isn't CouchDB awesome!
      roles: [],
      type: 'user',
    }),
  }
)
```

### Log in and out

CouchDB supports 4 login methods:

- [**Basic Authentication**](https://docs.couchdb.org/en/stable/api/server/authn.html#basic-authentication): Add
  username and password to every request.
- [**Cookie Authentication**](https://docs.couchdb.org/en/stable/api/server/authn.html#cookie-authentication): Use a
  special `_session` API to set a cookie. Which will be send on every request.
- [**Proxy Authentication**](https://docs.couchdb.org/en/stable/api/server/authn.html#proxy-authentication): Use an
  external authentication service.
- [**JWT Authentication**](https://docs.couchdb.org/en/stable/api/server/authn.html#jwt-authentication): Use
  externally-generated JWT tokens. (new in version 3.1)

We will be using **Cookie Authentication**. But first a little bit about **Basic Authentication**:

#### Basic Authentication

[**Basic Authentication**](https://docs.couchdb.org/en/stable/api/server/authn.html#basic-authentication) is when
you add the username and password in the header of every request.
[Read more on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#Basic_authentication_scheme).

You can add the login credentials by adding it to the URL or with the `auth` option when you create a new PouchDB
instance.

```javascript
const url = new URL('https://couchdb.example.com/')
url.pathname += getUserDatabaseName(username)
url.username = username
url.password = password

const remote = new PouchDB(url.href)

// or

const remoteDB = new PouchDB(
  `https://couchdb.example.com/${getUserDatabaseName(username)}`,
  {
    auth: {
      username: username,
      password: password,
    },
  }
)
```

It is inefficient, though. Because CouchDB has to re-hash the password on every request!

#### Cookie Authentication

By [**Cookie Authentication**](https://docs.couchdb.org/en/stable/api/server/authn.html#cookie-authentication) you
request a session cookie, and the cookie is then send on every request.

CouchDB's API is `POST`, `GET` and `DELETE` on `/_session`.

```javascript
// Login
const response = await fetch('https://couchdb.example.com/_session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: username,
    password: password,
  }),
})

// get session info
const response = await fetch('https://couchdb.example.com/_session', {
  credentials: 'include', // or 'same-origin' if it is
})

// log out
const response = await fetch('https://couchdb.example.com/_session', {
  method: 'DELETE',
  credentials: 'include', // or 'same-origin' if it is
})
```

### PouchDB Authentication

To make this tutorial easier to follow, we will be using the
[PouchDB Authentication](https://github.com/pouchdb-community/pouchdb-authentication) plugin.

It adds
[`remoteDB.logIn`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbloginusername-password--options--callback),
[`remoteDB.logOut`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dblogoutcallback),
[`remoteDB.getSession`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbgetsessionopts--callback),
[`remoteDB.signUp`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback),
and more to a PouchDB instance.

PouchDB Authentication must be run on a remote db instance.
But because our remote database is not at the _root-path_ (`/`) of our domain but on `/db/`,
PouchDB Authentication needs a _prefix_. A _prefix_ is added on the creation of a DB and prefixes its name.

The db _prefix_ is commonly used with [config defaults](https://pouchdb.com/api.html#defaults).
PouchDB's `defaults()` method returns a new constructor. That constructor works like the normal constructor,
but with the given options added.

```javascript
const HTTPPouch = PouchDB.defaults({
  prefix: 'https://expample.com/db',
})

// will be located at https://expample.com/db/myDb
const remoteDB = new HTTPPouch('myDb')
```

> Note! `remoteDB.signUp` will not work with **CouchDB v3**!
> But it will work for this tutorial.

## The session and sync component

Now let's implement it! You should have a `src/setupProxy.js` file as described in [Setup](./setup.md).

In our small tutorial app a single component will handle sessions and syncing!

### Install PouchDB Authentication

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D pouchdb-authentication
```

<!--yarn-->

```sh
yarn add -D pouchdb-authentication
```

<!--END_DOCUSAURUS_CODE_TABS-->

### Component

```jsx
// Session.js
import React, { useState, useEffect, useRef } from 'react'
import { usePouch } from 'use-pouchdb'
import PouchDB from 'pouchdb-browser'
import PouchAuth from 'pouchdb-authentication'

PouchDB.plugin(PouchAuth)

const sessionStates = {
  loading: 0,
  loggedIn: 1,
  loggedOut: 2,
}

const dbBaseUrl = new URL('/db/', window.location.href)
const HTTPPouch = PouchDB.defaults({
  prefix: dbBaseUrl.href,
})

export default function Session() {
  const db = usePouch()

  const remoteDbRef = useRef(null)
  if (remoteDbRef.current == null) {
    // create a default remote db
    remoteDbRef.current = new HTTPPouch('_users', {
      skip_setup: true, // prevents PouchDB from checking if the DB exists.
    })
  }

  const [sessionState, setSessionState] = useState(sessionStates.loading)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    // On first render: check if we are logged in
  }, [])

  useEffect(() => {
    // sync effect
    if (sessionState === sessionStates.loggedIn) {
      // we will implement it later
    }
  }, [sessionState, username, db])

  const doLogIn = async () => {
    // we will implement it later
  }

  const doSignUp = async event => {
    event.preventDefault()

    // we will implement it later
  }

  const doLogOut = async event => {
    event.preventDefault()

    // we will implement it later
  }

  switch (sessionState) {
    case sessionStates.loggedOut:
      return (
        <form
          onSubmit={event => {
            event.preventDefault()
            doLogIn()
          }}
        >
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              minLength="2"
              required
              value={username}
              onChange={event => {
                setUsername(event.target.value)
              }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              minLength="2"
              required
              value={password}
              onChange={event => {
                setPassword(event.target.value)
              }}
            />
          </label>
          <button>Log in</button>
          <button type="button" onClick={doSignUp}>
            Sign Up
          </button>
        </form>
      )

    case sessionStates.loggedIn:
      return (
        <div>
          Hello, {username}
          <button type="button" onClick={doLogOut}>
            Log out
          </button>
        </div>
      )

    case sessionStates.loading:
    default:
      return null
  }
}

function getUserDatabaseName(name, prefix = 'userdb-') {
  const encoder = new TextEncoder()
  const buffy = encoder.encode(name)
  const bytes = Array.from(buffy).map(byte =>
    byte.toString(16).padStart(2, '0')
  )
  return prefix + bytes.join('')
}
```

This is a more complicated component! It does quite a lot!

This component has 3 states:

- On first render; It checks the session and renders nothing.
- No user is logged in; It renders a log in and sign up form.
- User is logged in; It renders the username and a log out button.

The first `useEffect` only runs after the first render. It checks if a user is logged in.

The second `useEffect` runs every time the sessionState (or username, or the db) changes.
It will be responsible for starting and canceling the sync process.

Then we have `doLogIn`, `doSignUp` and `doLogOut`.

Let's implement the functions!

### Check session state

First lets implement checking the session:

Change the `checkSessionState` function to this:

```javascript
export default function Session() {
  // ...

  useEffect(() => {
    // On first render: check if we are logged in
    remoteDbRef.current
      .getSession()
      .then(sessionInfo => {
        const name = sessionInfo.userCtx.name
        if (name) {
          setSessionState(sessionStates.loggedIn)
          setUsername(name)
        } else {
          setSessionState(sessionStates.loggedOut)
          setUsername('')
          setPassword('')
        }
      })
      .catch(err => {
        console.error(err)
        setSessionState(sessionStates.loggedOut)
        setUsername('')
        setPassword('')
      })
  }, [])

  // ...
}
```

[remoteDB.getSession()](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbgetsessionopts--callback)
checks if there is a valid session. It always resolves into an object with an `userCtx`,
which has a name field.
If this name is `null`, then there is no active session, else it contains the username.

### Sign up

Next we implement `doSignUp`:

```javascript
export default function Session() {
  // ...

  const doSignUp = async event => {
    event.preventDefault()

    if (username.length === 0 || password.length === 0) return

    try {
      const response = await remoteDbRef.current.signUp(username, password)
      if (response.ok) {
        doLogIn()
      }
    } catch (err) {
      if (err.name === 'conflict') {
        // an user with that username already exists, choose another username
      } else if (err.name === 'forbidden') {
        // invalid username
      } else {
        // HTTP error, etc.
      }
    }
  }

  // ...
}
```

[`remoteDB.doSignUp`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback)
puts an [user-document](https://docs.couchdb.org/en/stable/intro/security.html#users-documents)
into the `_users` db.

If the sign up process did succeed, it will return the same response as PouchDB's `put`-method.
Here we check for the `ok` field. If it is `true`, then we log the user in.

When `doSignUp` calls `doLogIn`, `doLogIn` is the closure that references the same `username`
and `password` as `doSignUp` does.

### Log in

Next up `doLogIn`:

```javascript
export default function Session() {
  // ...

  const doLogIn = async () => {
    if (username.length === 0) return

    try {
      const response = await remoteDbRef.current.logIn(username, password)
      if (response.ok) {
        // Close the active remote db.
        await remoteDbRef.current.close()
        // Create the users db instance
        remoteDbRef.current = new HTTPPouch(getUserDatabaseName(response.name))

        setSessionState(sessionStates.loggedIn)
        setUsername(response.name)
        setPassword('')
      }
    } catch (err) {
      if (err.name === 'unauthorized' || err.name === 'forbidden') {
        // name or password incorrect
      } else {
        // HTTP error, etc.
      }
    }
  }

  // ...
}
```

[`doLogIn`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbloginusername-password--options--callback)
[`POST` to `/_session`](https://docs.couchdb.org/en/stable/api/server/authn.html#post--_session)
the users login data. If that succeeds, then it closes the placeholder remote db and
creates an instance of the users remote db.

### Log out

To end a session, update `doLogOut`:

```javascript
export default function Session() {
  // ...

  const doLogOut = async event => {
    event.preventDefault()

    try {
      const response = await remoteDbRef.current.logOut()

      if (response.ok) {
        // Close the active remote db.
        await remoteDbRef.current.close()

        // remote the current remote db.
        remoteDbRef.current = null

        // destroy local database, to remove all local data
        await db.destroy()

        setSessionState(sessionStates.loggedOut)
        setUsername('')
        setPassword('')
      }
    } catch (err) {
      // network error
    }
  }

  // ...
}
```

It sends a `DELETE` request to [`/_session`](https://docs.couchdb.org/en/stable/api/server/authn.html#delete--_session).

And `doLogOut` destroys the local database. When you destroy a database it's data will be deleted.
But the deletion will not be synced! In [`Add the Provider`](./provider.md) we did add an
event-listener for destroy events. And when the local database was destroyed, we did create a new
one. This was for logging out.

### Syncing

Now to the final section: Syncing our data!

Update the second `useEffect` hook:

```javascript
export default function Session() {
  // ...

  useEffect(() => {
    // sync effect
    if (sessionState === sessionStates.loggedIn && remoteDbRef.current) {
      // whenever we are logged in: start syncing

      // And sync
      const sync = db.sync(remoteDbRef.current, {
        retry: true,
        live: true,
      })
      return () => {
        // and cancel syncing whenever our sessionState changes
        sync.cancel()
      }
    }
  }, [sessionState, db])

  // ...
}
```

Yes, _thats it!_ One function call! Remember the update dance in
[Update docs](./update.md#todo-component-updates-the-doc)?
Because we did handle most conflict there, we can reduce our syncing down to this!

[`db.sync`](https://pouchdb.com/api.html#sync) starts a bidirectional data replication.
There is also a mono-directional data replication. In fact sync is a convenience method for calling
[`db.replicate`](https://pouchdb.com/api.html#replication) two times.

`retry: true` indicates that PouchDB will retry syncing (from where it left of) incase it did lose
connection.

`live: true` will include all future changes.

### Complete component

Your `Session.js` should look something like this:

```jsx
// Session.js
import React, { useState, useEffect, useRef } from 'react'
import { usePouch } from 'use-pouchdb'
import PouchDB from 'pouchdb-browser'
import PouchAuth from 'pouchdb-authentication'

PouchDB.plugin(PouchAuth)

const sessionStates = {
  loading: 0,
  loggedIn: 1,
  loggedOut: 2,
}

const dbBaseUrl = new URL('/db/', window.location.href)
const HTTPPouch = PouchDB.defaults({
  prefix: dbBaseUrl.href,
})

export default function Session() {
  const db = usePouch()

  const remoteDbRef = useRef(null)
  if (remoteDbRef.current == null) {
    // create a default remote db
    remoteDbRef.current = new HTTPPouch('_users', {
      skip_setup: true, // prevents PouchDB from checking if the DB exists.
    })
  }

  const [sessionState, setSessionState] = useState(sessionStates.loading)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    // On first render: check if we are logged in
    remoteDbRef.current
      .getSession()
      .then(sessionInfo => {
        const name = sessionInfo.userCtx.name
        if (name) {
          setSessionState(sessionStates.loggedIn)
          setUsername(name)
        } else {
          setSessionState(sessionStates.loggedOut)
          setUsername('')
          setPassword('')
        }
      })
      .catch(err => {
        console.error(err)
        setSessionState(sessionStates.loggedOut)
        setUsername('')
        setPassword('')
      })
  }, [])

  useEffect(() => {
    // sync effect
    if (sessionState === sessionStates.loggedIn && remoteDbRef.current) {
      // whenever we are logged in: start syncing

      // And sync
      const sync = db.sync(remoteDbRef.current, {
        retry: true,
        live: true,
      })
      return () => {
        // and cancel syncing whenever our sessionState changes
        sync.cancel()
      }
    }
  }, [sessionState, db])

  const doLogIn = async () => {
    if (username.length === 0) return

    try {
      const response = await remoteDbRef.current.logIn(username, password)
      if (response.ok) {
        // Close the active remote db.
        await remoteDbRef.current.close()
        // Create the users db instance
        remoteDbRef.current = new HTTPPouch(getUserDatabaseName(response.name))

        setSessionState(sessionStates.loggedIn)
        setUsername(response.name)
        setPassword('')
      }
    } catch (err) {
      if (err.name === 'unauthorized' || err.name === 'forbidden') {
        // name or password incorrect
      } else {
        // HTTP error, etc.
      }
    }
  }

  const doSignUp = async event => {
    event.preventDefault()

    if (username.length === 0 || password.length === 0) return

    try {
      const response = await remoteDbRef.current.signUp(username, password)
      if (response.ok) {
        doLogIn()
      }
    } catch (err) {
      if (err.name === 'conflict') {
        // an user with that username already exists, choose another username
      } else if (err.name === 'forbidden') {
        // invalid username
      } else {
        // HTTP error, etc.
      }
    }
  }

  const doLogOut = async event => {
    event.preventDefault()

    try {
      const response = await remoteDbRef.current.logOut()

      if (response.ok) {
        // Close the active remote db.
        await remoteDbRef.current.close()

        // remote the current remote db.
        remoteDbRef.current = null

        // destroy local database, to remove all local data
        await db.destroy()

        setSessionState(sessionStates.loggedOut)
        setUsername('')
        setPassword('')
      }
    } catch (err) {
      // network error
    }
  }

  switch (sessionState) {
    case sessionStates.loggedOut:
      return (
        <form
          onSubmit={event => {
            event.preventDefault()
            doLogIn()
          }}
        >
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              minLength="2"
              required
              value={username}
              onChange={event => {
                setUsername(event.target.value)
              }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              minLength="2"
              required
              value={password}
              onChange={event => {
                setPassword(event.target.value)
              }}
            />
          </label>
          <button>Log in</button>
          <button type="button" onClick={doSignUp}>
            Sign Up
          </button>
        </form>
      )

    case sessionStates.loggedIn:
      return (
        <div>
          Hello, {username}
          <button type="button" onClick={doLogOut}>
            Log out
          </button>
        </div>
      )

    case sessionStates.loading:
    default:
      return null
  }
}

function getUserDatabaseName(name, prefix = 'userdb-') {
  const encoder = new TextEncoder()
  const buffy = encoder.encode(name)
  const bytes = Array.from(buffy).map(byte =>
    byte.toString(16).padStart(2, '0')
  )
  return prefix + bytes.join('')
}
```

> We didn't implement error handling, because, well …, this component is already long.
>
> If you want to, you can add some error handling as an exercise. Read more about
> [CouchDB's Session API](https://docs.couchdb.org/en/stable/api/server/authn.html#cookie-authentication)
> to learn the error responses.

Finally add `Session.js` to `App.js`:

```jsx
import React, { useState, useEffect } from 'react'
import './App.css'

import PouchDB from 'pouchdb-browser'
import { Provider } from 'use-pouchdb'

import AddTodo from './AddTodo'
import Session from './Session'
import TodoList from './TodoList'

...
  return (
    <Provider pouchdb={db}>
      <div className="App">
        <Session />
        <TodoList />
        <AddTodo />
      </div>
    </Provider>
  )
```

If you now open a different browser, you will be able to sync your Todos between them!
