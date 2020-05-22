---
id: pouchdb_couchdb
title: Basic Tutorial for PouchDB and CouchDB
sidebar_label: PouchDB and CouchDB
---

This tutorial section is for you if you are new to the [PouchDB](https://pouchdb.com/) and [CouchDB](https://couchdb.apache.org/) ecosystem. It will give you an overview of PouchDB and some pointers where you can deepen your knowledge. Everyone that is already familiar with PouchDB/CouchDB can skip this section.

## Learn PouchDB

This is only an overview, a quick-start into PouchDB.

The [PouchDB guide](https://pouchdb.com/guides/) is a more in depth tutorial. I recommend it to every beginner.

To deepen your knowledge use [CouchDBs extensive documentation](https://docs.couchdb.org/en/stable/). It will go from setting it up, all through user management, views, to tips to write effective views. But most importantly, it teaches you how to think in CouchDB (and PouchDB).

## Why CouchDB and PouchDB?

There are multiple answers to this question. But without doubt the most prominent one is **synchronization**. CouchDB and PouchDB are build around the idea of syncing your data.

But not only live sync, but losing the connection, and continuing accessing and changing your data. And once your back online, sync it. With PouchDB on the clients browser and CouchDB on the backend your web app can become _offline capable_.

Then there is also the **changes feed**, which lists what did change in the order they did. Or that everything is stored as **JSON Objects**, or the **HTTP API** of CouchDB, and more.

## Basics

**CouchDB** is a schemaless, _NoSQL_ database, that stores its data in JSON-Objects (called **documents**). It's aim is in allowing you to sync your data between different instances of a database. You interface with it over HTTP. And yes it is save to expose your CouchDB instance to the web, because it has basic user management, authentication and authorization integrated!

If CouchDB is the big sibling, than **PouchDB** is its little sibling. PouchDB is a clone of CouchDB in JavaScript. It syncs with CouchDB. And you can use it in the browser, or your node app. It also has an [extensive plugin ecosystem](https://pouchdb.com/external.html).

Because PouchDB and CouchDB are so alike, and this package uses PouchDB, I will use PouchDB synonymously for PouchDB and CouchDB. If I explicitly mean CouchDB, then I will write CouchDB. If PouchDB is explicitly meant, then I will note it so, or if I write about a PouchDB plugin, it will always be PouchDB (the JS package).

> There is a [PouchDB Server](https://github.com/pouchdb/pouchdb-server). It implements more/most of CouchDBs API (like user management). And most of what will be marked as CouchDB also works with PouchDB Server. Which makes PouchDB Server an ideal candidate for development. But use CouchDB in production!

### About Databases

People new to PouchDB are often confused about it's terminology. What is a **database**? And why are there multiple? Are they like SQL tables? And are **documents** like rows?

The short answer: They are not.

The longer answer: A **database** (db) stores multiple **documents** (doc), and docs are a single data container. Documents have a unique ID (`_id`) per db. But there stops the similarities.

While tables require you to create a schema, which all rows must confirm to. A database is schemaless. Every doc could have a different structure. It is Recommended to add a `type` field on every document. Just like in [Redux Actions](https://redux.js.org/basics/actions).

In CouchDB access control is handled on a per database level. There is a common setup that gives every user their own db, to which only they have access (think of a note app).

It might be better to view databases as a collection of data, that should be synchronized together\*, and have access control\* on them. Fewer databases are better.

> \* You can filter out what will be synced, but not enforce it, and there is also work going on to add access control on a per doc basis to CouchDB.

### About Documents

Now what about documents? Documents (doc) are also not like SQL rows. View them more like, well, documents. While it is possible in modern office applications to link to external resources, it becomes difficult to share. And because PouchDB is all about sync, you don't have something like _foreign keys_. All data should life in the document.

Let's give you an example: Tags.

Normally you would store tags in SQL in their own table. Then create a table that links the tags to your to be tagged data, using foreign keys.

This is could become in a sync environment a hugh problem! What if the linking was changed, but the tagged data didn't sync yet? Because _networks fail_. Better store the tags in an array in the document. It is JSON after all. And not just the id to the tag, the tag _itself_. This way there will never be a link to something that doesn't exist.

But don't store _everything_ in a single document. The more a document incorporates, the more likely it becomes to cause conflicts.

Another example: [HospitalRun](https://hospitalrun.io/).

In HospitalRun they store patient data in 2 different documents types. In one they store the general data of a patient. While in the other type they store the data of a checkup. One document for every checkup. Reducing the possible data collisions.<br/>But they explain it better in this [talk from JSConfEU 2015](https://2015.jsconf.eu/speakers/patricia-garcia-good-tech-for-hard-places-fighting-ebola-with-javascript-offline-apps.html) (at 17:13):

<iframe width="560" height="315" src="https://www.youtube.com/embed/1sLjWlWvCsc?start=1033" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Show me some code!

Wow! That escalated.
