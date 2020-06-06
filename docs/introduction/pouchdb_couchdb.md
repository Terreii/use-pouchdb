---
id: pouchdb_couchdb
title: Basic Tutorial for PouchDB and CouchDB
sidebar_label: PouchDB and CouchDB
---

This tutorial section is for everyone new to the [PouchDB](https://pouchdb.com/) and
[CouchDB](https://couchdb.apache.org/) ecosystem. It will give you an overview of PouchDB and some pointers where
you can deepen your knowledge.

Everyone that is already familiar with PouchDB/CouchDB can skip this section.

## Learn PouchDB

This is only an overview, a quick-start into PouchDB.

The [PouchDB guide](https://pouchdb.com/guides/) is a more in depth tutorial. I recommend it to every beginner.

To deepen your knowledge use [CouchDBs extensive documentation](https://docs.couchdb.org/en/stable/). It will go
from setting it up, all through user management, views, to tips to write effective views. But most importantly, it
teaches you how to think in CouchDB (and PouchDB).

If you like to learn from videos: [IBM Cloudant](https://www.ibm.com/cloud/cloudant)
(CouchDB as a Service Provider) has a great course:

<iframe width="560" height="315" src="https://www.youtube.com/embed/videoseries?list=PLJa_sXrJUZb-Y4Q_5y3yPC8m5RxS5q-_J" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Why CouchDB and PouchDB?

There are multiple answers to this question. But without doubt the most prominent one is **synchronization**.
CouchDB and PouchDB are build around the idea of syncing your data.

But not only live sync, but losing the connection, and continuing accessing and changing your data. And once your
back online, sync it. With PouchDB on the clients browser and CouchDB on the backend your web app can become
_offline capable_.

Then there is also the **changes feed**, which lists what did change in the order they did. Or that everything is
stored as **JSON Objects**, or the **HTTP API** of CouchDB, or integrated user authentication and
authorization, and more.

## Basics

**CouchDB** is a schemaless, _NoSQL_ database, that stores its data in JSON-Objects (called **documents**). It's
aim is in allowing you to sync your data between different instances of a database. You interface with it over
HTTP. And yes it is save to expose your CouchDB instance to the web, because it has user authentication and
authorization integrated!

If CouchDB is the big sibling, than **PouchDB** is its little sibling. PouchDB is a clone of CouchDB in JavaScript.
It syncs with CouchDB. And you can use it in the browser, or your node app. It also has an
[extensive plugin ecosystem](https://pouchdb.com/external.html).

Because PouchDB and CouchDB are so alike, and this package uses PouchDB, I will use PouchDB synonymously for
PouchDB and CouchDB. If I explicitly mean CouchDB, then I will write CouchDB. If PouchDB is explicitly meant, then
I will note it so, or if I write about a PouchDB plugin, it will always be PouchDB (the JS package). The biggest
difference is that CouchDB's API are URLs while PouchDB's API are methods.

> There is a [PouchDB Server](https://github.com/pouchdb/pouchdb-server). It implements more/most
> of CouchDBs API (like authentication and authorization). And most of what will be marked as
> CouchDB also works with PouchDB Server. Which makes PouchDB Server an ideal candidate for
> development. But use CouchDB in production!

### About Databases

People new to PouchDB are often confused about it's terminology. What is a **database**? And why are there
multiple? Are they like SQL tables? And are **documents** like rows?

The short answer: They are not.

The longer answer: A **database** (db) stores multiple **documents** (doc), and docs are a single data container.
Documents have a unique ID (`_id`) per db. But there stops the similarities.

While tables require you to create a schema, which all rows must confirm to. A database is schemaless. Every doc
could have a different structure. It is Recommended to add a `type` field on every document. Just like in
[Redux Actions](https://redux.js.org/basics/actions).

In CouchDB access control is handled on a per database level. There is a common setup that gives every user their
own db, to which only they have access (think of a note app).

It might be better to view databases as a collection of data, that should be synchronized together\*, and have
access control\* on them. Fewer databases are better.

> \* You can filter out what will be synced, but not enforce it, and there is also work going on to add access
> control on a per doc basis to CouchDB.

### About Documents

Now what about documents? Documents (doc) are also not like SQL rows. View them more like, well, documents. While
it is possible in modern office applications to link to external resources, it becomes difficult to share. And
because PouchDB is all about sync, you don't have something like _foreign keys_. All data should life in the
document.

Let's give you an example: Tags.

Normally you would store tags in SQL in their own table. Then create a table that links the tags to your to be
tagged data, using foreign keys.

This could become in a sync environment a hugh problem! What if the linking was changed, but the tagged data didn't
sync yet? Because _networks fail_. Better store the tags in an array in the document. It is JSON after all. And not
just the id to the tag, the tag _itself_. This way there will never be a link to something that doesn't exist.

```json
{
  "_id": "The Matrix",
  "type": "movie",
  "tags": ["cyberpunk", "science fiction", "transgender-metaphor"],
  "writers": ["Lana Wachowski", "Lilly Wachowski"],
  "actors": [
    "Keanu Reeves",
    "Laurence Fishburne",
    "Carrie-Anne Moss",
    "Hugo Weaving",
    "Joe Pantoliano"
  ],
  "running_time": 136,
  "release": 1999
}
```

But don't store _everything_ in a single document. The more a document incorporates, the more likely it becomes to
cause conflicts.

Another example: [HospitalRun](https://hospitalrun.io/).

In HospitalRun they store patient data in 2 different documents types. In one they store the general data of a
patient. While in the other type they store the data of a checkup. One document for every checkup. Reducing the
possible data collisions.<br/>But Patricia Garcia explains it better in this
[talk from JSConfEU 2015](https://2015.jsconf.eu/speakers/patricia-garcia-good-tech-for-hard-places-fighting-ebola-with-javascript-offline-apps.html)
(at 17:13):

<iframe width="560" height="315" src="https://www.youtube.com/embed/1sLjWlWvCsc?start=1033" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Show me some code!

Wow! That escalated quickly. So much for a quick introduction…

### Setup PouchDB

With how PouchDB works out of the way, let's begin with using it! You can experiment with PouchDB in 3 different
ways:

- Run on pouchdb.com
- Get from a CDN
- install by npm

[There are more options](https://pouchdb.com/guides/setup-pouchdb.html). But this is a quick start.

#### Run on pouchdb.com

For quickly trying out PouchDB, [pouchdb.com](https://pouchdb.com/) has an instance of PouchDB running on their
site.

When you are there enter in your browsers console:

```javascript
PouchDB.version
```

And you should get something like `"6.2.0"`.

#### CDN

Add this to your `index.html`:

```html
<script src="//cdn.jsdelivr.net/npm/pouchdb@7.1.1/dist/pouchdb.min.js"></script>
```

#### npm

Install it with:

```sh
$ npm install pouchdb
```

or

```sh
$ yarn add pouchdb
```

You can now use it in `node`.

```javascript
const PouchDB = require('pouchdb')
```

To use it in your browser you have to bundle it. If you use [create-react-app](https://create-react-app.dev/) all
you have to to is import `pouchdb`.

```javascript
import PouchDB from 'pouchdb'
```

For the browser there is a special [`pouchdb-browser`](https://www.npmjs.com/package/pouchdb-browser) package. It
only ships with stuff for the browser.

```javascript
import PouchDB from 'pouchdb-browser'
```

### Create a database

The PouchDB export is a constructor/class. To create a local database instantiate it with a none URL like string:

```javascript
const db = new PouchDB('myDB')
```

`db` is the database instance.

If you want to access a remote database, then change the name to the url of the remote database. But not the URL
object.

```javascript
const remote = new PouchDB('https://example.com/myDB/')

// or with username and password:

const remote2 = new PouchDB('https://example.com/myDB/', {
  auth: {
    username: 'tester',
    password: 'geheim',
  },
})
```

More in the [PouchDB guide](https://pouchdb.com/guides/databases.html) or
[API documentation](https://pouchdb.com/api.html#create_database).

### Setup Sync

You don't have to do much to setup syncing. If you don't have a CouchDB instance running, you
probably won't be able to test this section. But later in the tutorials we will setup a PouchDB
Server and start syncing.

```javascript
// this syncs in both directions: from remote and to remote
const syncHandler = localDB
  .sync(remoteDB, {
    live: true, // continuously sync between local and remote.
    retry: true, // Retry on connection lost.
  })
  .on('paused', info => {
    // replication was paused, usually because of a lost connection.
  })
  .on('active', info => {
    // replication was resumed.
  })
  .on('change', change => {
    // something did change.
  })

// cancel replication/sync
syncHandler.cancel()
```

If you only what to sync in one direction there is also:

```javascript
localDB.replicate.to(remoteDB)
localDB.replicate.from(remoteDB)
```

They have the same options as sync.

To read more, visit [PouchDBs replication guide](https://pouchdb.com/guides/replication.html).

### Write a document

PouchDB has two methods to write/update a document:
[`db.put(doc)` and `db.post(doc)`](https://pouchdb.com/api.html#create_document).

What's the difference? `put` requires that the document has an `_id`, while `post` will auto generate (using
[UUID v4](https://www.npmjs.com/package/uuid)) an `_id` for you, if the document doesn't have one. And yes, they
are named after HTTP methods, because that's what CouchDB uses.

<!--DOCUSAURUS_CODE_TABS-->
<!--Async functions-->

```javascript
try {
  const response = await db.put({
    _id: 'myDoc',
    title: 'Welcome, to PouchDB!',
  })
} catch (err) {
  console.error(err)
}
```

<!--Promises-->

```javascript
db.put({
  _id: 'myDoc',
  title: 'Welcome, to PouchDB!',
})
  .then(response => {
    // handle response
  })
  .catch(err => {
    console.error(err)
  })
```

<!--Callbacks-->

```javascript
db.put(
  {
    _id: 'myDoc',
    title: 'Welcome, to PouchDB!',
  },
  (err, response) => {
    if (err) {
      console.error(err)
    } else {
      // handle response
    }
  }
)
```

<!--END_DOCUSAURUS_CODE_TABS-->

The response will be an object:

```json
{
  "ok": true,
  "id": "myDoc",
  "rev": "1-e78451c157971875ec76860d33e7da93"
}
```

`"ok": true` indicates that it did succeed. `"id": "myDoc"` is the documents `_id` (useful for `post`). And what is
`rev`?

> If you **update** a document you must supply the _complete_ document! _Not_ a diff. That version you supply will
> replace the old document.

### Revision (rev) and updating documents

There are two fields that every document in PouchDB has.

- `_id` (string) is a for the database unique identifier.
- `_rev` (string) is a version "number".

The rev consists out of two parts: a **number** and a **hash**. On every update the **number** will
be increased by 1. And a new **hash** calculated. If you update a document you must include the
`_rev` from the last version.

But why do we need `rev` in the first place?

It is all about **sync**. Or: PouchDB is a _distributed_ system. While you where updating a
document, someone else could have changed the doc, too!

Internal PouchDB keeps a rev-history of every document. If you sync, then PouchDB uses the
rev-history of a document to know if there is a conflict. Think like **Git** with
_fast-forward-merging_.

We are also not changing the `rev`. When we update a document we pass the old `_rev` along,
stating to PouchDB which is the previous version of that document.

Read more about it in the PouchDB guides about [working with documents](https://pouchdb.com/guides/documents.html)
and [updating and deleting documents](https://pouchdb.com/guides/updating-deleting.html) and
[conflicts](https://pouchdb.com/guides/conflicts.html).

### Reading a document

Now lets read a doc:

<!--DOCUSAURUS_CODE_TABS-->
<!--Async functions-->

```javascript
try {
  const doc = await db.get('myDoc')
} catch (err) {
  console.error(err)
}
```

<!--Promises-->

```javascript
db.get('myDoc')
  .then(doc => {
    // handle doc
  })
  .catch(err => {
    console.error(err)
  })
```

<!--Callbacks-->

```javascript
db.get('myDoc', (err, doc) => {
  if (err) {
    console.error(err)
  } else {
    // handle doc
  }
})
```

<!--END_DOCUSAURUS_CODE_TABS-->

Thats it!

If you didn't yet, you could read the [PouchDB's guide](https://pouchdb.com/guides/), or their
[Getting Started Guide](https://pouchdb.com/getting-started.html).

I think we are now ready for the first tutorial for `usePouchDB`!
