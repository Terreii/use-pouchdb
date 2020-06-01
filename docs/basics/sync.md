---
id: sync
title: Sync account
---

Now to Syncing over devices and user accounts.

CouchDB has integrated
[user authentication and authorization](https://docs.couchdb.org/en/3.1.0/intro/security.html)! We are going to use
it, together with the common setup of one database per user, to enable syncing.

You should have PouchDB-Server running for this section.

## A word about Version 3

With [version 3](https://docs.couchdb.org/en/3.1.0/whatsnew/3.0.html) Apache CouchDB's default settings became more
secure. Now every newly created database is _admin only_ by default. You must change the
[`_security` document](https://docs.couchdb.org/en/3.1.0/api/database/security.html#api-db-security) of a database,
to alow users to access it. This also affects the `_users` database. Which means, that you need admin rights to
create users.

Additionally you must change
[a config](https://docs.couchdb.org/en/3.1.0/config/couchdb.html#couchdb/users_db_security_editable) to be able to
change the `_security` document of the `_users` database. That config will be removed with version 4, though!

_What does that mean for this tutorial?_ This is a beginners guide. We will be using
[PouchDB-Server](https://github.com/pouchdb/pouchdb-server). At the time of writing, PouchDB-Server (v4.2) allows
everyone to sign up. And
[pouchdb-authentication](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback)
works fine. This does not mean PouchDB-Server is insecure! It just means that `_users`-database follows the rules
listed [here](https://docs.couchdb.org/en/3.1.0/intro/security.html#authentication-database).

_What does that mean for CouchDB App developers?_ The future is clear: You have to write a small server (or a bunch
of **serverless functions**) for **sign up**, **changing passwords**, **resetting passwords** and
**changing the username**. But CouchDB had already no way of send confirmation mails. So you already had to write
some logic yourself anyway. Now it is a little bit more.
**Please read [CouchDB's security tutorial](https://docs.couchdb.org/en/3.1.0/intro/security.html) before you
release your app!**

## couch_peruser

A common setup is [couch_peruser](https://docs.couchdb.org/en/3.1.0/config/couch-peruser.html). With
_couch_peruser_ every user has their own, private database. Database names are in the following form:
`userdb-{hex encoded username}`. Or in code:

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

> [couch_peruser](https://docs.couchdb.org/en/3.1.0/config/couch-peruser.html) became with Apache CouchDB version 3
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

The `skip_setup: true` is imported, because we didn't login in yet.

### Sign up

To [sign up a new user you `put`](https://docs.couchdb.org/en/3.1.0/intro/security.html#creating-a-new-user) a new
[user document](https://docs.couchdb.org/en/3.1.0/intro/security.html#users-documents) to the `_users` database.

```javascript
const response = await fetch(
  `http://localhost:5984/_users/org.couchdb.user:${username}`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: username,
      password: password, // will be hashed on the server.
      roles: [],
      type: 'user',
    }),
  }
)
```

But luckily [PouchDB Authentication](https://github.com/pouchdb-community/pouchdb-authentication) has a nice to use
[`signUp` method](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback):

```javascript
const response = await remoteDB.signUp(username, password)
```

It must be run on one of the remote databases.

### Log in and out

CouchDB supports 4 login methods:

- [**Basic Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#basic-authentication): Add
  username and password to every request.
- [**Cookie Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#cookie-authentication): Use a
  special `_session` API to set a cookie. Which will be send on every request.
- [**Proxy Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#proxy-authentication): Use an
  external authentication service.
- [**JWT Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#jwt-authentication): Use
  externally-generated JWT tokens. (new in version 3.1)

We will be using **Cookie Authentication**. But first a little bit about **Basic Authentication**:

#### Basic Authentication

[**Basic Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#basic-authentication) is when
you add the username and password in the header of every request.
[Read more on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#Basic_authentication_scheme).

You can add the login credentials by adding it to the URL or with the `auth` option when you create a new PouchDB
instance.

```javascript
const url = new URL('http://127.0.0.1:5984/')
url.pathname += getUserDatabaseName(username)
url.username = username
url.password = password

const remote = new PouchDB(url.href)

// or

const remoteDB = new PouchDB(
  `http://127.0.0.1:5984/${getUserDatabaseName(username)}`,
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

By [**Cookie Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#cookie-authentication) you
request a session cookie, and the cookie is then send on every request.

CouchDB's API is `POST`, `GET` and `DELETE` on `/_session`.

```javascript
// Login
const response = await fetch('http://localhost:5984/_session', {
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
const response = await fetch('http://localhost:5984/_session', {
  credentials: 'include', // or 'same-origin' if it is
})

// log out
const response = await fetch('http://localhost:5984/_session', {
  method: 'DELETE',
  credentials: 'include', // or 'same-origin' if it is
})
```

Or we user [PouchDB Authentication](https://github.com/pouchdb-community/pouchdb-authentication)'s methods:

```javascript
try {
  await remote.logIn(username, password)
  // did log in
} catch (err) {
  if (err.name === 'unauthorized' || err.name === 'forbidden') {
    // name or password incorrect
  } else {
    // cosmic rays, a meteor, etc.
  }
}

const response = await remote.getSession()
if (!response.userCtx.name) {
  // nobody's logged in
}

await remote.logOut()
```

Read more about
[`db.logIn`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbloginusername-password--options--callback),
[`db.logOut`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dblogoutcallback)
and
[`db.getSession`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbgetsessionopts--callback).

> You can enable the
> [`allow_persistent_cookies`](https://docs.couchdb.org/en/3.1.0/config/auth.html#couch_httpd_auth) config. If
> enabled CouchDB will refresh the session cookie, on request close the nearing expiration time.

#### About Cookies' sameSite attribute

You might get a notice that the Cookie "AuthSession" uses the
[`sameSite` attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite) wrong and
will be rejected in the future. Or if you are from the future, login doesn't work.

In Apache CouchDB you can set the config
[`[couch_httpd_auth] same_site`](https://docs.couchdb.org/en/3.1.0/config/auth.html#couch_httpd_auth/same_site) to
`strict`. This will fix this message. To validate you must restart your browser (just that the notice appears
again).

PouchDB-Server version 4.2 doesn't support it, yet. What you can do is Proxy every request to PouchDB-Server
through Create-react-app's dev server. Docs about proxy can be found
[here](https://create-react-app.dev/docs/proxying-api-requests-in-development).

First install [`http-proxy-middleware`](https://www.npmjs.com/package/http-proxy-middleware).

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D http-proxy-middleware
```

<!--yarn-->

```sh
yarn add -D http-proxy-middleware
```

<!--END_DOCUSAURUS_CODE_TABS-->

Next create `src/setupProxy.js` with the content of:

```javascript
const { createProxyMiddleware } = require('http-proxy-middleware')

module.exports = function (app) {
  app.use(
    '/db',
    createProxyMiddleware({
      target: 'http://localhost:5984',
      changeOrigin: true,
      pathRewrite: {
        '^/db': '/', // remove /db from the requests path
      },
    })
  )
}
```

After you restart your dev-server it will proxy all request to `/db/*` to your PouchDB-Server. You need to replace
the URLs in this section!

```javascript
new PouchDB('http://localhost:5984/db_name')

// into:

new PouchDB('http://localhost:3000/db/db_name')
// or if you want to be domain independent
new PouchDB(new URL('/db/db_name', window.location.href).href)
// or
new PouchDB('/db/db_name', { adapter: 'http' })
```

Many static site hosting provider allow you to setup a similar proxy.

## Session and sync functions

Now let's implement it!

This will be handled by our own global module. We will be using separate functions, because most of the session
logic will be handled by components.

```javascript
// account.js
import PouchDB from 'pouchdb-browser'
import auth from 'pouchdb-authentication'

PouchDB.plugin(auth) // register pouchdb-authentication as a plugin

let remote = new PouchDB(
  'http://localhost:5984/_users', // just a known existing db
  { skip_setup: true } // Don't check for the existence!
)

export function signUp(username, password) {
  return remote.signUp(username, password)
}

export async function logIn(username, password) {
  // throws the error of logIn
  const result = await remote.logIn(username, password)

  if (result.ok && result.name != null && result.name.length > 0) {
    // connect to the user database
    await remote.close()
    remote = new PouchDB(
      `http://localhost:5984/${getUserDatabaseName(username)}`
    )
    return result
  } else {
    throw new Error('user not logged in')
  }
}

export async function logOut() {
  await remote.close()
  return remote.logOut()
}

export function getSession() {
  return remote.getSession()
}

export async function getIsLoggedIn() {
  const session = await remote.getSession()

  return session.ok && session.userCtx && session.userCtx.name != null
}

// A useEffect friendly sync function
export function startSync(localDB) {
  let isActive = true
  let sync = null

  const syncing = async () => {
    const loggedIn = await getIsLoggedIn()

    if (loggedIn && isActive) {
      sync = localDB.sync(remote, {
        live: true,
        retry: true,
      })
    }
  }
  syncing()

  return () => {
    if (!isActive) {
      return
    }
    isActive = false
    if (sync) {
      sync.cancel()
    }
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

We don't have to handle incoming changes, because changes subscriptions on the local database are emitting events
when they are happening.

## Components

Now to the component:

```jsx
// Session.js
import React, { useState, useEffect } from 'react'
import { usePouch } from 'use-pouchdb'

import {
  signUp,
  logIn,
  logOut,
  getSession,
  getIsLoggedIn,
  startSync,
} from './account'

const sessionStates = {
  loading: 0,
  loggedIn: 1,
  loggedOut: 2,
}

export default function Session() {
  const db = usePouch()

  const [sessionState, setSessionState] = useState(sessionStates.loading)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const checkSessionState = async () => {
    const isLoggedIn = await getIsLoggedIn()
    setSessionState(isLoggedIn)

    if (isLoggedIn) {
      const info = await getSession()
      setUsername(info.userCtx.name)
    }
  }

  useEffect(() => {
    // On first render: check if we are logged in
    checkSessionState()
  }, [])

  useEffect(() => {
    if (sessionState === sessionStates.loggedIn) {
      // whenever we are logged in: start syncing
      return startSync(db)
    }
  }, [sessionState, db])

  async function doLogIn(event) {
    if (event) {
      event.preventDefault()
    }
    await logIn(username, password)
    checkSessionState()
  }

  async function doSignUp(event) {
    event.preventDefault()
    await signUp(username, password)
    doLogIn()
  }

  async function doLogOut(event) {
    event.preventDefault()
    await logOut()
    // destroy local database, to remove all local data
    await db.destroy()
    checkSessionState()
  }

  switch (sessionState) {
    case sessionStates.loggedOut:
      return (
        <form onSubmit={doLogIn}>
          <label>
            Username
            <input
              type="text"
              autocomplete="username"
              minlength="2"
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
              autocomplete="current-password"
              minlength="2"
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
```

This is a more complicated component! It does quite a lot!

This component has 3 states:

- On first render it checks the session and renders nothing.
- No user is logged in. It renders a log in and sign up form.
- User is logged in. It renders the username and a log out button.

The first `useEffect` only runs after the first render. It checks if a user is logged in.

The second `useEffect` runs every time the sessionState (or the db) changes. And if a user is logged in it starts
the sync process. Because `startSync` returns a cancel function, we can return the cancel function in the
`useEffect` body. It will then cancel every time the effect re-runs.

Then we have `doLogIn`, `doSignUp` and `doLogOut`. They call their counterpart in `account.js`, but also prevent
the default effects of dom-events.

`doSignUp` calls `doLogIn` after a new user was created.

`doLogIn` checks the session state after login.

And `doLogOut` destroys the local database. When you destroy a database it's data will be deleted. But the deletion
will not be synced! In [`Add the Provider`](./provider) we did add an event-listener for destroy events. And when
the local database was destroyed, we did create a new one. This was for logging out.

> We didn't implement error handling, because, well …, this component is already long.
>
> If you want to, you can add some error handling as an exercise. Read more about
> [PouchDB Authentication's API](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md)
> and [CouchDB's Session API](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#cookie-authentication) to learn
> the error responses.

If you now open a different browser, you will be able to sync your Todos between them. They should also be listed
in Fauxton (http://127.0.0.1:5984/_utils/#/_all_dbs).

Now we are finished with our Todo example. All Todos are replicated, users can sign up and log in. I know, this was
a long tutorial, but we did cover a lot!

Happy coding! 🎉🎊
