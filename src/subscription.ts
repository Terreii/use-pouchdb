import { clone } from 'pouchdb-utils'

export type Callback<T extends {}> = (
  deleted: boolean,
  id: PouchDB.Core.DocumentId,
  doc?: PouchDB.Core.Document<T>
) => void

interface DocsSubscription {
  changesFeed: PouchDB.Core.Changes<{}>
  all: Set<Callback<{}>>
  ids: Map<PouchDB.Core.DocumentId, Set<Callback<{}>>>
}

export default function subscriptionManager(pouch: PouchDB.Database) {
  let docsSubscription: DocsSubscription | null = null

  return {
    subscribeToDocs: <T extends {}>(
      ids: PouchDB.Core.DocumentId[] | null,
      callback: Callback<T>
    ): (() => void) => {
      if (docsSubscription == null) {
        docsSubscription = createDocSubscription(pouch)
      }

      const isIds = Array.isArray(ids) && ids.length > 0

      if (isIds) {
        for (const id of ids!) {
          if (docsSubscription.ids.has(id)) {
            docsSubscription.ids.get(id)?.add(callback as Callback<{}>)
          } else {
            const set: Set<Callback<{}>> = new Set()
            set.add(callback as Callback<{}>)
            docsSubscription.ids.set(id, set)
          }
        }
      } else {
        docsSubscription.all.add(callback as Callback<{}>)
      }

      let didUnsubscribe = false
      return () => {
        if (didUnsubscribe) return
        didUnsubscribe = true

        if (isIds) {
          for (const id of ids!) {
            const set = docsSubscription?.ids.get(id)
            set?.delete(callback as Callback<{}>)

            if (set?.size === 0) {
              docsSubscription?.ids.delete(id)
            }
          }
        } else {
          docsSubscription?.all.delete(callback as Callback<{}>)
        }

        if (
          docsSubscription?.all.size === 0 &&
          docsSubscription.ids.size === 0
        ) {
          docsSubscription.changesFeed.cancel()
          docsSubscription = null
        }
      }
    },

    subscribeToView: (
      _fun: string | PouchDB.Map<{}, {}> | PouchDB.Filter<{}, {}>,
      _callback: (id: PouchDB.Core.DocumentId) => void
    ): (() => void) => {
      return () => {}
    },
  }
}

function createDocSubscription(pouch: PouchDB.Database): DocsSubscription {
  let docsSubscription: DocsSubscription

  const changesFeed = pouch
    .changes({
      since: 'now',
      live: true,
    })
    .on('change', change => {
      const hasAll =
        docsSubscription?.all != null && docsSubscription.all.size > 0
      const hasId = docsSubscription && docsSubscription.ids.has(change.id)

      if (change.deleted) {
        if (hasAll) {
          notify(docsSubscription.all, true, change.id)
        }
        if (hasId) {
          notify(docsSubscription.ids.get(change.id)!, true, change.id)
        }
      } else {
        pouch
          .get(change.id)
          .then(doc => {
            if (hasAll) {
              notify(docsSubscription.all, false, change.id, doc)
            }
            if (hasId) {
              notify(
                docsSubscription.ids.get(change.id)!,
                false,
                change.id,
                doc
              )
            }
          })
          .catch(console.error)
      }
    })

  docsSubscription = {
    changesFeed,
    all: new Set(),
    ids: new Map(),
  }

  return docsSubscription
}

function notify(
  set: Set<Callback<{}>>,
  deleted: boolean,
  id: PouchDB.Core.DocumentId,
  doc?: PouchDB.Core.Document<{}>
) {
  for (const subscription of set) {
    try {
      const document = doc ? clone(doc) : undefined
      subscription(deleted, id, document)
    } catch (err) {
      console.error(err)
    }
  }
}
