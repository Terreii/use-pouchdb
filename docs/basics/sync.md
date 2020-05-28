---
id: sync
title: Sync account
---

Now to Syncing over devices and user accounts.

CouchDB has integrated [user authentication and authorization](https://docs.couchdb.org/en/3.1.0/intro/security.html)! We are going to use it, together with the common setup of one database per user, to enable syncing.

You should have PouchDB-Server running for this section.

## A word about Version 3

With [version 3](https://docs.couchdb.org/en/3.1.0/whatsnew/3.0.html) Apache CouchDB's default settings became more secure. Now every newly created database is _admin only_ by default. You must change the [`_security document`](https://docs.couchdb.org/en/3.1.0/api/database/security.html#api-db-security) of a database, to alow users to access it. This also affects the `_users` database.

Additionally you must change [a config](https://docs.couchdb.org/en/3.1.0/config/couchdb.html#couchdb/users_db_security_editable) to be able to change the `_security document` of the `_users` database. That config will be removed with version 4, through!

_What does that mean for this tutorial?_ This is a beginners guide. We will be using [PouchDB-Server](https://github.com/pouchdb/pouchdb-server). At the time of writing, PouchDB-Server (v4.2) allows everyone to sign up. And [pouchdb-authentication](https://github.com/pouchdb-community/pouchdb-authentication/blob/master/docs/api.md#dbsignupusername-password--options--callback) works fine. This does not mean PouchDB-Server is insecure! It just means that `_users`-database follows the rules listed [here](https://docs.couchdb.org/en/3.1.0/intro/security.html#authentication-database).

_What does that mean for CouchDB App developers?_ The future is clear: You have to write a small server (or a bunch of **serverless functions** _hint, hint, wink, wink_) for **sign up**, **changing passwords**, **resetting passwords** and **changing the username**. But CouchDB had already no way of send confirmation mails. So you already had to write some logic yourself anyway. **Please read [CouchDB's security tutorial](https://docs.couchdb.org/en/3.1.0/intro/security.html) before you release your app!**

## couch_peruser

A common setup is [couch_peruser](https://docs.couchdb.org/en/3.1.0/config/couch-peruser.html). With _couch_peruser_ every user has their own, private database. Database names are in the following form: `userdb-{hex encoded username}`. Or in code:

```javascript
/**
 * Get the name of the users remote-database.
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

> [couch_peruser](https://docs.couchdb.org/en/3.1.0/config/couch-peruser.html) became with Apache CouchDB version 3 a setting. If enabled, CouchDB will create for every user a database, pre-configured for their access!
>
> But couch_peruser was before version 3 possible, you just had to do everything yourself.

### Access a remote Database

To access a remote database a new instance of PouchDB must be created. But with the name a url-string:

```javascript
const url = new URL('http://127.0.0.1:5984/')
url.pathname = '/' + getUserDatabaseName(username)
const remote = new PouchDB(url.href, { skip_setup: true })

// Or if you already know the username and password:
// const remote = new PouchDB(url.href, {
//   auth: {
//     username: username,
//     password: password
//   }
// })
```

### Sign up

### Log in

### Log out

## Components

## Sync
