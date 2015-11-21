import assert from 'assert'
import MongoStorage from '../lib/MongoStorage'
import { collectionName, docId, field, value } from './util'

let mongoUrl = 'mongodb://localhost:27017/test'
let storage = new MongoStorage(mongoUrl)

describe.skip('MongoStorage', () => {
  before(() => {
    return storage.init()
  })

  beforeEach(() => {
    return storage.clear()
  })

  it('should save and get doc', () => {
    let prevVersion = null
    let version = '2'
    let state = {
      [field]: value
    }
    let ops = []
    return storage
      .saveDoc(collectionName, docId, state, prevVersion, version, ops)
      .then(() => {
        return storage
          .getDocById(collectionName, docId)
          .then((doc) => {
            assert(doc)
            assert.equal(doc._id, docId)
            assert.equal(doc._v, version)
            assert.equal(doc[field], value)
          })
      })
  })

  it('should save and get docs', () => {
    let prevVersion = null
    let version = '2'
    let state = {
      [field]: value
    }
    let ops = []
    return storage
      .saveDoc(collectionName, docId, state, prevVersion, version, ops)
      .then(() => {
        return storage
          .getDocsByQuery(collectionName, {[field]: value})
          .then((docs) => {
            assert(docs)
            assert.equal(docs.length, 1)
            assert.equal(docs[0]._id, docId)
            assert.equal(docs[0]._v, version)
            assert.equal(docs[0][field], value)
          })
      })
  })
})
