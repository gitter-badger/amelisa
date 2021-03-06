// let debug = require('debug')('ClientQuery')
import Query from './Query'
import RemoteDoc from './RemoteDoc'
import { dbFields } from '../util'

class ClientQuery extends Query {
  constructor (collectionName, expression, model, collection, querySet) {
    super(collectionName, expression)
    this.model = model
    this.collection = collection
    this.querySet = querySet
  }

  getStateFromDocData (doc) {
    let state = {}
    for (let field in doc) {
      if (!dbFields[field]) state[field] = doc[field]
    }
    return state
  }

  getStatesFromDocs (docs) {
    if (!this.isDocs) return docs
    return docs.map((doc) => this.getStateFromDocData(doc))
  }

  attachDocsToCollection (docs) {
    for (let docId in docs) {
      let ops = docs[docId]
      let serverVersion = RemoteDoc.prototype.getVersionFromOps(ops)
      let doc = this.collection.getDoc(docId)
      if (doc) {
        doc.applyOps(ops)
        doc.distillOps()
        doc.serverVersion = serverVersion
      } else {
        doc = this.collection.attach(docId, ops, serverVersion)
      }
      doc.save()
    }
  }

  refresh () {
    let docs = this.collection.getDocs()
    let docDatas = this.getQueryResultFromArray(docs, this.expression)
    if (this.isDocs) {
      this.data = docDatas.map((docData) => docData._id)
    } else {
      this.data = docDatas
    }
  }

  onCollectionChange = (op) => {
    this.refresh(op)
  };
}

export default ClientQuery
