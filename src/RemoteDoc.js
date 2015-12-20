let debug = require('debug')('RemoteDoc')
import MutableDoc from './MutableDoc'
import util from './util'

class RemoteDoc extends MutableDoc {
  constructor (docId, ops, collection, model, storage, serverVersion) {
    super(docId, ops, collection, model, storage)
    this.serverVersion = serverVersion
    this.subscribed = 0
  }

  refresh () {
    this.refreshState()
    this.emit('change')
  }

  fetch () {
    return this.model.sendOp({
      type: 'fetch',
      collectionName: this.collection.name,
      docId: this.docId
    })
  }

  subscribe () {
    this.subscribed++
    if (this.subscribed !== 1) return Promise.resolve()

    return this.model.sendOp({
      type: 'sub',
      collectionName: this.collection.name,
      docId: this.docId,
      version: this.version()
    })
  }

  unsubscribe () {
    this.subscribed--
    if (this.subscribed !== 0) return Promise.resolve()

    return this.model.sendOp({
      type: 'unsub',
      collectionName: this.collection.name,
      docId: this.docId
    })
  }

  onSubscribed (serverVersion) {
    debug('subscribed', serverVersion)
    this.serverVersion = serverVersion
    this.save()

    let opsToSend = this.getOpsToSend(serverVersion)
    for (let op of opsToSend) {
      this.model.send(op)
    }
  }

  onOp (op) {
    debug('onOp', op)
    super.onOp(op)
    return this.model.send(op)
  }

  receiveOp (op) {
    debug('receiveOp', op.type)
    let shouldEmit = this.shouldEmit(op)
    this.applyOp(op)
    if (shouldEmit) this.emit('change')
    this.collection.emit('change', op)
    this.save()
  }

  rejectOp (opId) {
    let op = this.ops.find((op) => op.id === opId)
    debug('rejectOp', opId, op, this.ops.length, this.get())
    if (op) {
      util.arrayRemove(this.ops, op)
      this.refreshState()
      this.emit('change')
      this.collection.emit('change', op)
      this.save()
    }
  }

  sendAllOps () {
    for (let op of this.ops) {
      this.model.send(op)
    }
  }

  getSyncData () {
    let data = {
      ops: this.getOpsToSend(this.serverVersion)
    }

    if (this.listeners('change').length > 0) {
      data.version = this.version()
    }

    return data
  }
}

export default RemoteDoc