let debug = require('debug')('Collection');
import { EventEmitter } from 'events';
import ClientDoc from './ClientDoc';

class Collection extends EventEmitter {
  constructor(name, data = {}, model, storage) {
    super();
    this.name = name;
    this.data = data;
    this.model = model;
    this.storage = storage;
  }

  get(docId) {
    return this.data[docId];
  }

  getDocs() {
    let docs = [];
    for (let docId in this.data) {
      let doc = this.data[docId].get();
      if (doc) docs.push(doc);
    }
    return docs;
  }

  add(docId, docData, callback) {
    let op = {
      source: this.model.source,
      type: 'add',
      date: this.model.date(),
      collectionName: this.name,
      docId: docId,
      value: docData
    };

    let ops = [op];
    let doc = this.attach(docId, ops, null);
    debug('emit change on add');
    this.emit('change', op);
    doc.save();
    doc.send(op, callback);
    return doc;
  }

  attach(docId, ops, serverVersion) {
    let doc = new ClientDoc(docId, ops, serverVersion, this, this.model, this.storage);
    this.data[docId] = doc;
    return doc;
  }

  unattach(docId) {
    delete this.data[docId];
  }

  fillFromClientStorage() {
    return new Promise((resolve, reject) => {
      this.storage
        .getAllDocs(this.name)
        .then((docs) => {
          for (let doc of docs) {
            this.attach(doc._id, doc._ops, doc._sv);
          }
          resolve();
        })
        .catch((err) => {
          console.error('Collection.fillFromClientStorage', err);

          // Resolve anyway
          resolve();
        });
    });
  }

  sync() {
    for (let docId in this.data) {
      let doc = this.data[docId];
      doc.sync();
    }
  }
}

export default Collection;