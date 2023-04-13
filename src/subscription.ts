import { clone } from 'pouchdb-utils'

export type DocsCallback<T extends Record<string, unknown>> = (
  deleted: boolean,
  id: PouchDB.Core.DocumentId,
  doc?: PouchDB.Core.Document<T>
) => void

interface DocsSubscription {
  changesFeed: PouchDB.Core.Changes<Record<string, unknown>>
  all: Set<DocsCallback<Record<string, unknown>>>
  ids: Map<PouchDB.Core.DocumentId, Set<DocsCallback<Record<string, unknown>>>>
}

export type ViewCallback = (id: PouchDB.Core.DocumentId) => void
export type subscribeToView = (
  fun: string,
  callback: ViewCallback
) => () => void

interface SubscriptionToAView {
  feed: PouchDB.Core.Changes<Record<string, unknown>>
  callbacks: Set<ViewCallback>
}
export type subscribeToDocs = <T extends Record<string, unknown>>(
  ids: PouchDB.Core.DocumentId[] | null,
  callback: DocsCallback<T>
) => () => void

export default class SubscriptionManager {
  #pouch: PouchDB.Database
  #destroyListener: () => void

  #docsSubscription: DocsSubscription | null = null
  #viewsSubscription = new Map<string, SubscriptionToAView>()

  #didUnsubscribeAll = false

  constructor(pouch: PouchDB.Database) {
    this.#pouch = pouch
    this.#destroyListener = () => {
      this.unsubscribeAll()
    }
    pouch.once('destroyed', this.#destroyListener)
  }

  subscribeToDocs<T extends Record<string, unknown>>(
    ids: PouchDB.Core.DocumentId[] | null,
    callback: DocsCallback<T>
  ): () => void {
    if (this.#didUnsubscribeAll) {
      return () => {
        return
      }
    }

    if (this.#docsSubscription == null) {
      this.#docsSubscription = createDocSubscription(this.#pouch)
    }

    const isIds = Array.isArray(ids) && ids.length > 0

    if (isIds) {
      for (const id of ids ?? []) {
        if (this.#docsSubscription.ids.has(id)) {
          this.#docsSubscription.ids
            .get(id)
            ?.add(callback as DocsCallback<Record<string, unknown>>)
        } else {
          const set: Set<DocsCallback<Record<string, unknown>>> = new Set()
          set.add(callback as DocsCallback<Record<string, unknown>>)
          this.#docsSubscription.ids.set(id, set)
        }
      }
    } else {
      this.#docsSubscription.all.add(
        callback as DocsCallback<Record<string, unknown>>
      )
    }

    let didUnsubscribe = false
    return () => {
      if (didUnsubscribe || this.#didUnsubscribeAll) return
      didUnsubscribe = true

      if (isIds) {
        for (const id of ids ?? []) {
          const set = this.#docsSubscription?.ids.get(id)
          set?.delete(callback as DocsCallback<Record<string, unknown>>)

          if (set?.size === 0) {
            this.#docsSubscription?.ids.delete(id)
          }
        }
      } else {
        this.#docsSubscription?.all.delete(
          callback as DocsCallback<Record<string, unknown>>
        )
      }

      if (
        this.#docsSubscription?.all.size === 0 &&
        this.#docsSubscription.ids.size === 0
      ) {
        this.#docsSubscription.changesFeed.cancel()
        this.#docsSubscription = null
      }
    }
  }

  subscribeToView(fun: string, callback: ViewCallback): () => void {
    if (this.#didUnsubscribeAll) {
      return () => {
        return
      }
    }

    let subscription: SubscriptionToAView

    if (this.#viewsSubscription.has(fun)) {
      subscription = this.#viewsSubscription.get(fun) as SubscriptionToAView
    } else {
      subscription = subscribeToView(this.#pouch, fun)
      this.#viewsSubscription.set(fun, subscription)
    }

    subscription.callbacks.add(callback)

    let didUnsubscribe = false
    return () => {
      if (didUnsubscribe || this.#didUnsubscribeAll) return
      didUnsubscribe = true

      subscription.callbacks.delete(callback)

      if (subscription.callbacks.size === 0) {
        subscription.feed.cancel()
        this.#viewsSubscription.delete(fun)
      }
    }
  }

  unsubscribeAll(): void {
    if (this.#didUnsubscribeAll) return
    this.#didUnsubscribeAll = true

    this.#pouch.removeListener('destroyed', this.#destroyListener)

    if (this.#docsSubscription) {
      this.#docsSubscription.changesFeed.cancel()
      this.#docsSubscription.all.clear()
      this.#docsSubscription.ids.forEach(set => {
        set.clear()
      })
      this.#docsSubscription.ids.clear()
    }

    for (const viewInfo of this.#viewsSubscription.values()) {
      viewInfo.feed.cancel()
      viewInfo.callbacks.clear()
    }
    this.#viewsSubscription.clear()
  }
}

function createDocSubscription(pouch: PouchDB.Database): DocsSubscription {
  let docsSubscription: DocsSubscription | null = null

  const changesFeed = pouch
    .changes({
      since: 'now',
      live: true,
    })
    .on('change', change => {
      const hasAll = (docsSubscription?.all.size ?? 0) > 0
      const idSubscriptions = docsSubscription?.ids.get(change.id)

      if (change.deleted) {
        if (hasAll && docsSubscription) {
          notify(docsSubscription.all, true, change.id)
        }
        if (idSubscriptions) {
          notify(idSubscriptions, true, change.id)
        }
      } else {
        pouch
          .get(change.id)
          .then(doc => {
            if (hasAll && docsSubscription) {
              notify(
                docsSubscription.all,
                false,
                change.id,
                doc as unknown as PouchDB.Core.Document<Record<string, unknown>>
              )
            }
            if (idSubscriptions) {
              notify(
                idSubscriptions,
                false,
                change.id,
                doc as unknown as PouchDB.Core.Document<Record<string, unknown>>
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
  set: Set<DocsCallback<Record<string, unknown>>>,
  deleted: boolean,
  id: PouchDB.Core.DocumentId,
  doc?: PouchDB.Core.Document<Record<string, unknown>>
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
  let viewsSubscription: SubscriptionToAView | null = null

  const changesFeed = pouch
    .changes({
      since: 'now',
      live: true,
      filter: '_view',
      view,
    })
    .on('change', change => {
      for (const callback of viewsSubscription?.callbacks ?? []) {
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
