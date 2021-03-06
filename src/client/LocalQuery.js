// let debug = require('debug')('LocalQuery')
import ClientQuery from './ClientQuery'

class LocalQuery extends ClientQuery {
  constructor (collectionName, expression, model, collection, querySet) {
    super(collectionName, expression, model, collection, querySet)
    this.local = true
    this.refresh()
  }

  refresh (op) {
    super.refresh(op)

    // TODO: emit only if there were changes
    this.emit('change')
  }

  async subscribe () {
    this.collection.on('change', this.onCollectionChange)
  }

  async unsubscribe () {
    this.collection.removeListener('change', this.onCollectionChange)
  }
}

export default LocalQuery
