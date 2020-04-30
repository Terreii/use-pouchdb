export default function subscriptionManager(_pouch: PouchDB.Database) {
  return {
    subscribeToDocs: <T extends {}>(
      _ids: PouchDB.Core.DocumentId[] | null,
      _callback: (doc: PouchDB.Core.Document<T>) => void
    ): (() => void) => {
      return () => {}
    },
    subscribeToView: (
      _fun: string | PouchDB.Map<{}, {}> | PouchDB.Filter<{}, {}>,
      _callback: (id: PouchDB.Core.DocumentId) => void
    ): (() => void) => {
      return () => {}
    },
  }
}
