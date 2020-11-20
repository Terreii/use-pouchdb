---
id: setup
title: Basic Setup
sidebar_label: Setup
---

You need to have `node` and `npm` installed. Both are bundled together and can be downloaded at
[nodejs.org](https://nodejs.org/).

## Setup Create-React-App

In this tutorial we will be using [Create-React-App](https://create-react-app.dev/). It's fast to start and not
opinionated.

Open your terminal and navigate to your development directory. Then enter:

```sh
npx create-react-app use-pouchdb-todo
cd use-pouchdb-todo
npm start
```

This will create a new project with create-react-app installed. `npm start` will start your development server. To
visit your app open http://localhost:3000/.

Your app client is in `src/`. When ever you change something, the development server will live reload your app!

## PouchDB and usePouchDB

Next up is **PouchDB**. Lets install **PouchDB** and **usePouchDB**:

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D pouchdb-browser use-pouchdb
```

<!--yarn-->

```sh
yarn add -D pouchdb-browser use-pouchdb
```

<!--END_DOCUSAURUS_CODE_TABS-->

## CouchDB backend

Now which to use? **CouchDB** or **PouchDB-Server**? Well, normally both.
PouchDB-Server is local to the project. It is installable with **npm**, you can configure it
[with a JSON file](https://github.com/pouchdb/pouchdb-server#configuration).
While CouchDB is the one you will be using in production. It is more powerful.
So I normally recommend that you install both. PouchDB-Server for your day to day development.
And CouchDB to verify and test if everything works. But to only get started,
PouchDB-Server is enough. And that is why we are going to be using PouchDB-Server for this guide.

There are some incompatibilities though.

While PouchDB-Server is intended as a drop-in replacement of CouchDB, the later moves faster.
At the time of writing, <time datetime="2020-05-23">2020-05-23</time>, CouchDB did release
[version 3](https://docs.couchdb.org/en/stable/whatsnew/3.0.html)
and PouchDB-Server didn't catchup yet.

Regarding compatibility the biggest change was, that the default setup of CouchDB _is more secure_.
In previous versions with the standard setup, everyone could create an user.
Now you must be an admin or change some settings.

Now, CouchDB lacks some user management features; for example sending Mails to the user, or
password recovery. You need to implement them yourself. With
[serverless functions (function as a service)](https://en.wikipedia.org/wiki/Function_as_a_service)
it became more strait forward. But log in/out didn't change.

In this tutorial we will be using the old sign up method, where everyone can create an account.
If in your app you need more, please visit
[CouchDBs Security section](https://docs.couchdb.org/en/stable/intro/security.html).

> You don't need CouchDB installed for this tutorial!
>
> Because you have to change some security settings, it might be better to _only_ use
> PouchDB-Server for the beginning. And when you are more comfortable with PouchDB and its
> distributed nature, learn more about Apache CouchDB.

### Installing PouchDB Server / express-pouchdb

[PouchDB-Server](https://www.npmjs.com/package/pouchdb-server) can be found on `npm`.
But to make this tutorial even more strait forward we won't be using PouchDB-Server! But
[express-pouchdb](https://www.npmjs.com/package/express-pouchdb).
We will be using it, because then we don't have to deal with CORS and running two processes.

Express-Pouchdb is part of the [PouchDB-Server project](https://github.com/pouchdb/pouchdb-server)
and includes everything we need. In fact it is what PouchDB-Server uses.
PouchDB-Server adds some cli and config tools.

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i pouchdb-node express-pouchdb
```

<!--yarn-->

```sh
yarn add pouchdb-node express-pouchdb
```

<!--END_DOCUSAURUS_CODE_TABS-->

All options can be found in [the README](https://github.com/pouchdb/pouchdb-server#express-pouchdb).

For this tutorial we add express-pouchdb to the Create-React-App dev-server.
Please create in your `src` a `setupProxy.js` file with this content:

```javascript
// The node version of PouchDB (without browser stuff)
const PouchDB = require('pouchdb-node')
const expressPouchDB = require('express-pouchdb')

module.exports = function (app) {
  // app is the Create-React-App dev server.
  // Our databases will be available at http://localhost:3000/db/*
  app.use('/db', expressPouchDB(PouchDB))
}
```

In production you would have to use [Express.js](https://expressjs.com/) or use Apache CouchDB.
There are also some [CouchDB as a Service providers](./more.md).
