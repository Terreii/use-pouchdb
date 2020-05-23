---
id: setup
title: Basic Setup
sidebar_label: Setup
---

You need to have `node` and `npm` installed. Both are bundled together and can be downloaded at [nodejs.org](https://nodejs.org/).

## Setup Create-React-App

In this tutorial we will be using [Create-React-App](https://create-react-app.dev/). It's fast to start and not opinionated.

Open your terminal and navigate to your development directory. Then enter:

```sh
npx create-react-app use-pouchdb-todo
cd use-pouchdb-todo
npm start
```

This will create a new project with create-react-app installed. `npm start` will start your development server. To visit your app open http://localhost:3000/.

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

There is a PouchDB plugin for the sign up, log in and log out flow: [PouchDB Authentication](https://github.com/pouchdb-community/pouchdb-authentication).

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

## CouchDB backend

Now which to use? **CouchDB** or **PouchDB-Server**? Well, normally both. PouchDB-Server is local to the project. You can install it with **npm**, you can define where it should store its data. While CouchDB will be the one you will be using in production. It is more powerful. So I normally recommend that you install both. PouchDB-Server for your development. And CouchDB to verify and test if everything works. But to only get started, PouchDB-Server is enough.

There are some incompatibilities through.

While PouchDB-Server is intended as a drop-in replacement of CouchDB, the later moves faster. At the time of writing, <time datetime="2020-05-23">2020-05-23</time>, CouchDB did release [version 3](https://docs.couchdb.org/en/3.1.0/whatsnew/3.0.html) and PouchDB-Server didn't catchup yet.

Regarding compatibility the biggest change was, that the default setup of CouchDB _is more secure_. In previous versions in the standard setup, everyone could create an user. Now you must be an admin or change some settings.

Now, CouchDB lacks some user management features; for example sending Mails to the user, or resetting a password. You need to implement them yourself. With [serverless functions (function as a service)](https://en.wikipedia.org/wiki/Function_as_a_service) it became more strate forward. But you won't be able to use every method of **PouchDB Authentication**. Log in/out still works through.

In this tutorial we will be using the old sign up method, where everyone can create an account and no verification mail is send. If in your app you need more, please visit [CouchDBs Security section](https://docs.couchdb.org/en/stable/intro/security.html).

> You don't need CouchDB installed for this tutorial!
>
> Because you have to change some security settings, it might be better to _only_ use PouchDB-Server for the beginning.

### Installing PouchDB

[PouchDB-Server](https://www.npmjs.com/package/pouchdb-server) can be found on `npm`.

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D pouchdb-server
```

<!--yarn-->

```sh
yarn add -D pouchdb-server
```

<!--END_DOCUSAURUS_CODE_TABS-->

To start enter:

```sh
npx pouchdb-server
```

All options can be found at [the README](https://github.com/pouchdb/pouchdb-server#readme).

Now it would be good if we could start the create-react-app dev-server and pouchdb-server with only one command!
<br />First install [npm-run-all](https://www.npmjs.com/package/npm-run-all). It allows us to run multiple commands in parallel or sequential.

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm i -D npm-run-all
```

<!--yarn-->

```sh
yarn add -D npm-run-all
```

<!--END_DOCUSAURUS_CODE_TABS-->

Now open `package.json` and change your scripts:

```json
{
  "scripts": {
    "start": "npm-run-all --parallel start:*",
    "start:pouch": "pouchdb-server --dir db",
    "start:cra": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

Now with `npm start` or `yarn start` both you dev-server and pouchdb-server will start! To start just one enter:

<!--DOCUSAURUS_CODE_TABS-->
<!--npm-->

```sh
npm run start:pouch
# or
npm run start:cra
```

<!--yarn-->

```sh
yarn run start:pouch
# or
yarn run start:cra
```

<!--END_DOCUSAURUS_CODE_TABS-->

We are now all set!

### Installing CouchDB

> You don't need CouchDB installed for this tutorial! PouchDB-Server is more than enough.
>
> This is only for completion sake here!

You can download CouchDB on it's [webpage](https://couchdb.apache.org/).

When you run CouchDB the first time, it will terminate with an error message, that you need to setup an admin. You can setup an admin [using the this config instructions](https://docs.couchdb.org/en/stable/config/auth.html#config-admins). Where you can find the config files [is documented in the _Introduction To Configuring_](https://docs.couchdb.org/en/stable/config/intro.html).

Once CouchDB starts you can Relax™. From now on you can configure everything over HTTP or CouchDBs web-interface, **Fauxton**.

To access Fauxton go to http://127.0.0.1:5984/_utils/. If CouchDB runs on an other port, change the port.

We are now going to restore the < v3 user behavior. Future tutorials will expect the new v3+ access control through.

- First login to Fauxton with your admin account.
- Go to **Configuration**.
- Set in **Main config** the setting `users_db_security_editable` to `true`. This will allow you to change the security settings of the `_users` db.
- Go to setup.
- Follow the `Configure a Single Note` setup.
- Now go to **Databases**.
- Navigate to `_users`.
- Click on the lock icon on `_users`.
- Now remote the `_admin` in **Roles** under **Members**. This will reset access to `_users` to pre v3: Everyone can sign up, but only access their own user-document.

> Before you release something: Read the documentations! Specially about [Security](https://docs.couchdb.org/en/stable/intro/security.html)! It is the **_Users_** database after all!
>
> What we did change here is only for development!
