let debug = require('debug')('IndexedDbStorage')

const dbName = 'amelisa'

class IndexedDbStorage {
  constructor (collectionNames = [], version) {
    this.collectionNames = collectionNames
    this.version = version
  }

  async getCollectionNames () {
    return this.collectionNames
  }

  getExistingCollectionNames () {
    return Array.from(this.db.objectStoreNames)
  }

  async init () {
    return new Promise((resolve, reject) => {
      let request = window.indexedDB.open(dbName, this.version)
      request.onsuccess = (event) => {
        debug('onsuccess')
        this.db = event.target.result
        let existingCollectionNames = this.getExistingCollectionNames()
        this.existingCollectionNames = existingCollectionNames
        resolve(this)
      }
      request.onupgradeneeded = (event) => {
        debug('onupgradeneeded', event)
        this.db = event.target.result
        let existingCollectionNames = this.getExistingCollectionNames()
        this.existingCollectionNames = existingCollectionNames
        this.db.onerror = (event) => {
          debug('onerror upgrage', event)
        }

        for (let collectionName of this.collectionNames) {
          debug('collectionName', collectionName)
          if (existingCollectionNames.indexOf(collectionName) > -1) continue

          let objectStore = this.db.createObjectStore(collectionName, {keyPath: '_id'})
          objectStore.transaction.oncomplete = (e) => {
            debug('oncomplete', e)
            // TODO: handle it
          }
          objectStore.transaction.onerror = (e) => {
            debug('onerror', e)
          }
        }
      }
      request.onerror = (event) => {
        debug('onerror', event)
        reject(event.target.webkitErrorMessage || event.target.error)
      }
    })
  }

  getObjectStore (collectionName, transactionType) {
    if (Array.from(this.db.objectStoreNames).indexOf(collectionName) === -1) {
      debug('No colleciton ' + collectionName + ' in IndexedDB')
    }
    let transaction = this.db.transaction(collectionName, transactionType)
    return transaction.objectStore(collectionName)
  }

  // async getDocById (collectionName, docId) {
  //   return new Promise((resolve, reject) => {
  //     let objectStore = this.getObjectStore(collectionName, 'readonly')
  //     let request = objectStore.get(docId)
  //     request.onsuccess = (event) => {
  //       resolve(event.target.result)
  //     }
  //     request.onerror = (event) => {
  //       reject(event.target.webkitErrorMessage || event.target.error)
  //     }
  //   })
  // }

  async getAllDocs (collectionName) {
    return new Promise((resolve, reject) => {
      let docs = []
      let objectStore = this.getObjectStore(collectionName, 'readonly')

      let request = objectStore.openCursor()
      request.onsuccess = (event) => {
        let cursor = event.target.result
        if (cursor) {
          docs.push(cursor.value)
          cursor.continue()
        } else {
          resolve(docs)
        }
      }
      request.onerror = (event) => {
        reject(event.target.webkitErrorMessage || event.target.error)
      }
    })
  }

  // getAllDocs (collectionName) {
  //   return this.getDocsByQuery(collectionName, MongoQueries.allSelector)
  // }

  // async getDocsByQuery (collectionName, expression) {
  //   return new Promise((resolve, reject) => {
  //     let allDocs = []
  //     let objectStore = this.getObjectStore(collectionName, 'readonly')
  //
  //     let request = objectStore.openCursor()
  //     request.onsuccess = (event) => {
  //       let cursor = event.target.result
  //       if (cursor) {
  //         allDocs.push(cursor.value)
  //         cursor.continue()
  //       } else {
  //         let docs = this.getQueryResultFromArray(allDocs, expression)
  //         resolve(docs)
  //       }
  //     }
  //     request.onerror = (event) => {
  //       reject(event.target.webkitErrorMessage || event.target.error)
  //     }
  //   })
  // }

  async clearCollection (collectionName) {
    return new Promise((resolve, reject) => {
      let objectStore = this.getObjectStore(collectionName, 'readwrite')
      let request = objectStore.clear()
      request.onsuccess = (event) => {
        resolve()
      }
      request.onerror = (event) => {
        reject(event.target.webkitErrorMessage || event.target.error)
      }
    })
  }

  async clear () {
    let promises = []

    for (let collectionName of this.collectionNames) {
      promises.push(this.clearCollection(collectionName))
    }

    return Promise.all(promises)
  }

  async saveDoc (collectionName, docId, state, serverVersion, version, ops) {
    let doc = {
      _id: docId,
      _ops: ops,
      // _v: version,
      _sv: serverVersion
    }

    // for (let key in state) {
    //   doc[key] = state[key]
    // }

    return new Promise((resolve, reject) => {
      let objectStore = this.getObjectStore(collectionName, 'readwrite')
      let updateRequest = objectStore.put(doc)
      updateRequest.onsuccess = (event) => {
        resolve()
      }
      updateRequest.onerror = (event) => {
        reject(event.target.webkitErrorMessage || event.target.error)
      }
    })
  }
}

export default IndexedDbStorage