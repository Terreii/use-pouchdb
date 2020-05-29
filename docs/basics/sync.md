---
id: sync
title: Sync account
---

Now to Syncing over devices and user accounts.

CouchDB has integrated [user authentication and authorization](https://docs.couchdb.org/en/3.1.0/intro/security.html)! We are going to use it, together with the common setup of one database per user, to enable syncing.

You should have PouchDB-Server running for this section.

## A word about Version 3

With [version 3](https://docs.couchdb.org/en/3.1.0/whatsnew/3.0.html) Apache CouchDB's default settings became more secure. Now every newly created database is _admin only_ by default. You must change the [`_security document`](https://docs.couchdb.org/en/3.1.0/api/database/security.html#api-db-security) of a database, to alow users to access it. This also affects the `_users` database. Which means, that you need admin rights to create users.

Additionally you must change [a config](https://docs.couchdb.org/en/3.1.0/config/couchdb.html#couchdb/users_db_security_editable) to be able to change the `_security document` of the `_users` database. That config will be removed with version 4, though!

_What does that mean for this tutorial?_ This is a beginners guide. We will be using [PouchDB-Server](https://github.com/pouchdb/pouchdb-server). At the time of writing, PouchDB-Server (v4.2) allows everyone to sign up. And [pouchdb-authentication](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback) works fine. This does not mean PouchDB-Server is insecure! It just means that `_users`-database follows the rules listed [here](https://docs.couchdb.org/en/3.1.0/intro/security.html#authentication-database).

_What does that mean for CouchDB App developers?_ The future is clear: You have to write a small server (or a bunch of **serverless functions**) for **sign up**, **changing passwords**, **resetting passwords** and **changing the username**. But CouchDB had already no way of send confirmation mails. So you already had to write some logic yourself anyway. Now it is a little bit more. **Please read [CouchDB's security tutorial](https://docs.couchdb.org/en/3.1.0/intro/security.html) before you release your app!**

## couch_peruser

A common setup is [couch_peruser](https://docs.couchdb.org/en/3.1.0/config/couch-peruser.html). With _couch_peruser_ every user has their own, private database. Database names are in the following form: `userdb-{hex encoded username}`. Or in code:

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

> [couch_peruser](https://docs.couchdb.org/en/3.1.0/config/couch-peruser.html) became with Apache CouchDB version 3 a setting. If enabled, CouchDB will create for every user a database, pre-configured for their access!
>
> But couch_peruser was before version 3 possible, you just had to do everything yourself.

## Basics

First some basics about sessions in CouchDB and PouchDB-Server.

### Access a remote Database

To access a remote database, create new instance of PouchDB with a url-string as the name:

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

To [sign up a new user you `put`](https://docs.couchdb.org/en/3.1.0/intro/security.html#creating-a-new-user) a new [user document](https://docs.couchdb.org/en/3.1.0/intro/security.html#users-documents) to the `_users` database.

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

But luckily [PouchDB Authentication](https://github.com/pouchdb-community/pouchdb-authentication) has a nice to use [`signUp` method](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback):

```javascript
const response = await remoteDB.signUp(username, password)
```

It must be run on one of the remote databases.

### Log in and out

CouchDB supports 4 login methods:

- [**Basic Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#basic-authentication): Add username and password to every request.
- [**Cookie Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#cookie-authentication): Use a special `_session` API to set a cookie. Which will be send on every request.
- [**Proxy Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#proxy-authentication): Use an external authentication service.
- [**JWT Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#jwt-authentication): Use externally-generated JWT tokens. (new in version 3.1)

We will be using **Cookie Authentication**. But first a little bit about **Basic Authentication**:

#### Basic Authentication

[**Basic Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#basic-authentication) is when you add the username and password in the header of every request. [Read more on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#Basic_authentication_scheme).

You can add the login credentials by adding it to the URL or with the `auth` option when you create a new PouchDB instance.

```javascript
const url = new URL('http://127.0.0.1:5984/')
url.pathname = '/' + getUserDatabaseName(username)
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

By [**Cookie Authentication**](https://docs.couchdb.org/en/3.1.0/api/server/authn.html#cookie-authentication) you request a session cookie, and the cookie is then send on every request.

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

Read more about [`db.logIn`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbloginusername-password--options--callback), [`db.logOut`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dblogoutcallback) and [`db.getSession`](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbgetsessionopts--callback).

> You can enable the [`allow_persistent_cookies`](https://docs.couchdb.org/en/3.1.0/config/auth.html#couch_httpd_auth) config. If enabled CouchDB will refresh the session cookie, on request close the nearing expiration time.

#### About Cookies' sameSite attribute

You might get a notice that the Cookie "AuthSession" uses the [`sameSite` attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite) wrong and will be rejected in the future. Or if you are from the future, login doesn't work.

In Apache CouchDB you can set the config [`[couch_httpd_auth] same_site`](https://docs.couchdb.org/en/3.1.0/config/auth.html#couch_httpd_auth/same_site) to `strict`. This will fix this message. To validate you must restart your browser.

PouchDB-Server version 4.2 doesn't support it, yet. What you can do is Proxy every request to PouchDB-Server through Create-react-app's dev server. Docs about proxy can be found [here](https://create-react-app.dev/docs/proxying-api-requests-in-development).

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

After you restart your dev-server it will proxy all request to `/db/*` to your PouchDB-Server. You need to replace the URLs in this section!

```javascript
new PouchDB('http://localhost:5984/db_name')

// into:

new PouchDB('/db/db_name') // it is on the same host after all!
```

Many static site host provider allow you to setup a similar proxy.

## Components

## Sync
