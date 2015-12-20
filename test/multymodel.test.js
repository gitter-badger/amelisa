import assert from 'assert'
import { MemoryStorage, Store } from '../src'
import { collectionName, docId, expression, joinExpression, field, value } from './util'

let storage
let store
let model
let model2

describe('multymodel', () => {
  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()

    store = new Store(storage)
    model = store.createModel()
    model.source = 'model1'
    model2 = store.createModel()
    model2.source = 'model2'
  })

  it('should subscribe doc and get it', async () => {
    let subscribes = [[collectionName, docId]]

    let subscription = await model.subscribe(subscribes)

    let data = subscription.get()
    let doc = data[0]
    assert(!doc)

    let docData = {
      _id: docId,
      [field]: value
    }

    return new Promise((resolve, reject) => {
      subscription.on('change', () => {
        let data = subscription.get()
        let doc = data[0]
        assert(doc)
        resolve()
      })

      model2.add(collectionName, docData)
    })
  })

  it('should subscribe query and get it', async () => {
    let subscribes = [[collectionName, expression]]

    let subscription = await model.subscribe(subscribes)

    let data = subscription.get()
    let query = data[0]
    assert.equal(query.length, 0)

    let doc = {
      _id: docId,
      [field]: value
    }

    return new Promise((resolve, reject) => {
      subscription.on('change', () => {
        let data = subscription.get()
        query = data[0]
        assert.equal(query.length, 1)

        resolve()
      })

      model2.add(collectionName, doc)
    })
  })

  // FIXME: fails sometimes
  it.skip('should subscribe query, and get doc changes', async () => {
    let subscribes = [[collectionName, expression]]
    let value2 = 'value2'

    let subscription = await model.subscribe(subscribes)

    let data = subscription.get()
    let query = data[0]
    assert.equal(query.length, 0)

    let doc = {
      _id: docId,
      [field]: value
    }

    return new Promise((resolve, reject) => {
      subscription.once('change', () => {
        let data = subscription.get()
        query = data[0]
        assert.equal(query.length, 1)

        subscription.on('change', () => {
          assert.equal(model.get(collectionName, docId, field), value2)

          resolve()
        })
        model2.set([collectionName, docId, field], value2)
      })
      model2.add(collectionName, doc)
    })
  })

  it('should subscribe query two times', async () => {
    let value2 = 'value2'

    let doc = {
      [field]: value
    }

    let doc2 = {
      name: value2
    }

    await* [
      model2.add(collectionName, doc),
      model2.add(collectionName, doc2)
    ]

    let query1 = model.query(collectionName, {[field]: value})
    await model.subscribe(query1)
    assert.equal(query1.get().length, 1)

    let query2 = model.query(collectionName, {[field]: value2})
    await model.subscribe(query2)

    assert.equal(query2.get().length, 1)
  })

  it('should subscribe join query and get it', async () => {
    let subscribes = [[collectionName, joinExpression]]

    let subscription = await model.subscribe(subscribes)
    let data = subscription.get()
    let query = data[0]
    assert.equal(query.length, 0)

    let doc = {
      _id: docId,
      [field]: value
    }

    let category = {
      _id: '1',
      userId: docId
    }

    return new Promise((resolve, reject) => {
      subscription.once('change', () => {
        let data = subscription.get()
        query = data[0]
        assert.equal(query.length, 1)

        subscription.once('change', () => {
          let data = subscription.get()
          query = data[0]
          assert.equal(query.length, 0)

          subscription.once('change', () => {
            let data = subscription.get()
            query = data[0]
            assert.equal(query.length, 1)

            resolve()
          })
          let user2 = {
            _id: '2',
            [field]: value
          }
          model2.add(collectionName, user2)
        })
        model2.set(['categories', '1', 'userId'], '2')
      })

      model2.add(collectionName, doc)
      model2.add('categories', category)
    })
  })
})