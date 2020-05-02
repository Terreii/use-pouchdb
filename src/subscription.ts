import { clone } from 'pouchdb-utils'

export type DocsCallback<T extends {}> = (
  deleted: boolean,
  id: PouchDB.Core.DocumentId,
  doc?: PouchDB.Core.Document<T>
) => void

interface DocsSubscription {
  changesFeed: PouchDB.Core.Changes<{}>
  all: Set<DocsCallback<{}>>
  ids: Map<PouchDB.Core.DocumentId, Set<DocsCallback<{}>>>
}

export type ViewCallback = (id: PouchDB.Core.DocumentId) => void
export type subscribeToView = (
  fun: string,
  callback: ViewCallback
) => () => void

interface SubscriptionToAView {
  feed: PouchDB.Core.Changes<{}>
  callbacks: Set<ViewCallback>
}
export type subscribeToDocs = <T extends {}>(
  ids: PouchDB.Core.DocumentId[] | null,
  callback: DocsCallback<T>
) => () => void

export type SubscriptionManager = {
  subscribeToDocs: <T extends {}>(
    ids: string[] | null,
    callback: DocsCallback<T>
  ) => () => void
  subscribeToView: (fun: string, callback: ViewCallback) => () => void
  unsubscribeAll(): void
}

export default function createSubscriptionManager(pouch: PouchDB.Database) {
  let docsSubscription: DocsSubscription | null = null
  const viewsSubscription = new Map<string, SubscriptionToAView>()

  let didUnsubscribeAll = false

  return {
    subscribeToDocs: <T extends {}>(
      ids: PouchDB.Core.DocumentId[] | null,
      callback: DocsCallback<T>
    ): (() => void) => {
      if (didUnsubscribeAll) return () => {}

      if (docsSubscription == null) {
        docsSubscription = createDocSubscription(pouch)
      }

      const isIds = Array.isArray(ids) && ids.length > 0

      if (isIds) {
        for (const id of ids!) {
          if (docsSubscription.ids.has(id)) {
            docsSubscription.ids.get(id)?.add(callback as DocsCallback<{}>)
          } else {
            const set: Set<DocsCallback<{}>> = new Set()
            set.add(callback as DocsCallback<{}>)
            docsSubscription.ids.set(id, set)
          }
        }
      } else {
        docsSubscription.all.add(callback as DocsCallback<{}>)
      }

      let didUnsubscribe = false
      return () => {
        if (didUnsubscribe || didUnsubscribeAll) return
        didUnsubscribe = true

        if (isIds) {
          for (const id of ids!) {
            const set = docsSubscription?.ids.get(id)
            set?.delete(callback as DocsCallback<{}>)

            if (set?.size === 0) {
              docsSubscription?.ids.delete(id)
            }
          }
        } else {
          docsSubscription?.all.delete(callback as DocsCallback<{}>)
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

    subscribeToView: (fun: string, callback: ViewCallback): (() => void) => {
      if (didUnsubscribeAll) return () => {}

      let subscription: SubscriptionToAView

      if (viewsSubscription.has(fun)) {
        subscription = viewsSubscription.get(fun)!
      } else {
        subscription = subscribeToView(pouch, fun)
        viewsSubscription.set(fun, subscription)
      }

      subscription.callbacks.add(callback)

      let didUnsubscribe = false
      return () => {
        if (didUnsubscribe || didUnsubscribeAll) return
        didUnsubscribe = true

        subscription.callbacks.delete(callback)

        if (subscription.callbacks.size === 0) {
          subscription.feed.cancel()
          viewsSubscription.delete(fun)
        }
      }
    },

    unsubscribeAll() {
      if (didUnsubscribeAll) return
      didUnsubscribeAll = true

      if (docsSubscription) {
        docsSubscription.changesFeed.cancel()
        docsSubscription.all.clear()
        docsSubscription.ids.forEach(set => {
          set.clear()
        })
        docsSubscription.ids.clear()
      }

      for (const viewInfo of viewsSubscription.values()) {
        viewInfo.feed.cancel()
        viewInfo.callbacks.clear()
      }
      viewsSubscription.clear()
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
  set: Set<DocsCallback<{}>>,
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

function subscribeToView(
  pouch: PouchDB.Database,
  view: string
): SubscriptionToAView {
  let viewsSubscription: SubscriptionToAView

  const changesFeed = pouch
    .changes({
      since: 'now',
      live: true,
      filter: '_view',
      view,
    })
    .on('change', change => {
      for (const callback of viewsSubscription.callbacks) {
        try {
          callback(change.id)
        } catch (err) {
          console.error(err)
        }
      }
    })

  viewsSubscription = {
    feed: changesFeed,
    callbacks: new Set(),
  }

  return viewsSubscription
}
