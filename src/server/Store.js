let debug = require('debug')('Store')
import { EventEmitter } from 'events'
import ChannelSession from './ChannelSession'
import Projection from './Projection'
import ServerDocSet from './ServerDocSet'
import ServerQuerySet from './ServerQuerySet'
import ServerChannel from './ServerChannel'
import Model from '../client/Model'
import { arrayRemove } from '../util'

const defaultOptions = {
  collections: {},
  projections: {},
  source: 'server',
  unattachTimeout: 5000
}

class Store extends EventEmitter {
  constructor (storage, pub, sub, options = {}) {
    super()
    this.storage = storage
    this.pub = pub
    this.sub = sub
    this.options = Object.assign({}, defaultOptions, options)
    this.docSet = new ServerDocSet(this)
    this.querySet = new ServerQuerySet(this)
    this.clients = []
    this.projections = {}
    this.clientCollectionNames = []
    this.projectionHashes = {}
    this.sentOps = {}

    if (sub) sub.on('message', this.onPubSubOp.bind(this))

    for (let collectionName in this.options.collections) {
      let collectionOptions = this.options.collections[collectionName]
      if (collectionOptions.client) this.clientCollectionNames.push(collectionName)
    }

    for (let collectionName in this.options.projections) {
      let projectionOptions = this.options.projections[collectionName]
      let projection = new Projection(collectionName,
        projectionOptions.collectionName, projectionOptions.fields)
      this.projections[collectionName] = projection
      this.projectionHashes[collectionName] = projection.getHash()
    }
  }

  createModel (options) {
    let channel = new ServerChannel()
    let channel2 = new ServerChannel()
    channel.pipe(channel2).pipe(channel)
    let model = new Model(channel, this.source, Object.assign({}, this.options, options), this.projectionHashes)
    model.server = true

    this.onChannel(channel2)
    channel.open()

    return model
  }

  connectModel (model) {
    let { channel } = model
    let channel2 = new ServerChannel()
    channel.pipe(channel2).pipe(channel)

    this.onChannel(channel2)
    channel.open()
  }

  onChannel (channel) {
    debug('onChannel', channel.server)
    channel._session = new ChannelSession()
    this.clients.push(channel)

    channel.on('message', (message) => {
      debug('message', message)
      this.validateMessage(message, channel)
        .catch((err) => {
          let op = {
            ackId: message.id,
            collectionName: message.collectionName,
            docId: message.docId,
            error: 'Internal Error'
          }
          this.sendOp(op, channel)

          console.error('validateMessage error', err, err.stack)
        })
    })

    channel.on('close', () => {
      debug('close', this.clients.length)
      arrayRemove(this.clients, channel)
      this.docSet.channelClose(channel)
      this.querySet.channelClose(channel)
    })

    channel.on('error', (err) => {
      debug('error', err)
    })

    this.emit('channel', channel)
  }

  async validateMessage (message, channel) {
    if (this.preHook) {
      let { session, params } = this.getHookParams(channel)

      try {
        await this.preHook(message, session, params)
      } catch (err) {
        let op = {
          ackId: message.id,
          collectionName: message.collectionName,
          docId: message.docId,
          error: err && err.message
        }
        return this.sendOp(op, channel)
      }
    }

    await this.onMessage(message, channel)
  }

  async onMessage (message, channel) {
    let { type, id, collectionName, docId, expression, value, version, docIds } = message
    let doc
    let query
    let op

    switch (type) {
      case 'handshake':
        op = {
          type: 'handshake',
          ackId: id,
          value: {
            collectionNames: this.clientCollectionNames,
            date: Date.now(),
            projectionHashes: this.projectionHashes,
            version: this.options.version
          }
        }
        this.sendOp(op, channel)
        break

      case 'sync':
        let syncData = value
        let docPromises = []

        for (let collectionName in syncData.collections) {
          let collectionSyncData = syncData.collections[collectionName]
          for (let docId in collectionSyncData) {
            let { ops, version } = collectionSyncData[docId]
            let docPromise = this.docSet
              .getOrCreateDoc(collectionName, docId)
              .then((doc) => {
                for (let op of ops) {
                  doc.onOp(op)
                  this.onOp(op)
                }
                doc.subscribe(channel, version)
              })
            docPromises.push(docPromise)
          }
        }

        await Promise.all(docPromises)

        let queryPromises = []

        for (let hash in syncData.queries) {
          let { collectionName, expression, docIds } = syncData.queries[hash]
          let queryPromise = this.querySet
            .getOrCreateQuery(collectionName, expression)
            .then((query) => {
              query.subscribe(channel, docIds)
            })
          queryPromises.push(queryPromise)
        }
        await Promise.all(queryPromises)

        op = {
          type: 'sync',
          ackId: id
        }
        this.sendOp(op, channel)
        break

      case 'fetch':
        doc = await this.docSet.getOrCreateDoc(collectionName, docId)
        doc.fetch(channel, version, id)
        break

      case 'qfetch':
        query = await this.querySet.getOrCreateQuery(collectionName, expression)
        query.fetch(channel, docIds, id)
        break

      case 'sub':
        doc = await this.docSet.getOrCreateDoc(collectionName, docId)
        doc.subscribe(channel, version, id)
        break

      case 'unsub':
        doc = await this.docSet.getOrCreateDoc(collectionName, docId)
        doc.unsubscribe(channel)
        break

      case 'qsub':
        query = await this.querySet.getOrCreateQuery(collectionName, expression)
        query.subscribe(channel, docIds, id)
        break

      case 'qunsub':
        query = await this.querySet.getOrCreateQuery(collectionName, expression)
        query.unsubscribe(channel)
        break

      case 'add':
      case 'set':
      case 'del':
        doc = await this.docSet.getOrCreateDoc(collectionName, docId)
        doc.onOp(message, channel)

        // FIXME: remove listener if reject
        doc.once('saved', () => {
          op = {
            ackId: id
          }
          this.sendOp(op, channel)
          this.onOp(message)
        })

        let { session, params } = this.getHookParams(channel)
        if (this.afterHook) {
          try {
            await this.afterHook(message, session, params)
          } catch (err) {
            console.error('afterHook', err, err.stack)
            return
          }
        }
        break

      default:
    }
  }

  getHookParams (channel) {
    let { req, server } = channel
    let session = req ? req.session : undefined
    let params = {
      server
    }

    return {
      session,
      params
    }
  }

  onOp (op) {
    this.querySet.onOp(op)
    this.docSet.onOp(op)
    this.sentOps[op.id] = true
    if (this.pub) this.pub.send(op)
  }

  onPubSubOp (op) {
    if (this.sentOps[op.id]) {
      delete this.sentOps[op.id]
      return
    }
    this.querySet.onOp(op)
    this.docSet.onOp(op)
  }

  sendOp (op, channel) {
    debug('sendOp', op.type, op)

    try {
      channel.send(op)
    } catch (err) {
      console.error('sendOp error', err)
    }
  }

  modelMiddleware () {
    let store = this
    function modelMiddleware (req, res, next) {
      let requestTimeout = req.socket.server.timeout
      let model

      function getModel () {
        if (model) return model
        model = store.createModel({fetchOnly: true}, req)
        return model
      }
      req.getModel = getModel

      function closeModel () {
        req.getModel = () => {}
        res.removeListener('finish', closeModel)
        res.removeListener('close', closeModel)
        model && model.close()
        model = null
      }
      function closeModelAfterTimeout () {
        setTimeout(closeModel, requestTimeout)
      }
      res.on('finish', closeModel)
      res.on('close', closeModelAfterTimeout)

      next()
    }
    return modelMiddleware
  }
}

export default Store
