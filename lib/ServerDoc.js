let debug = require('debug')('ServerDoc');
import Doc from './Doc';
import util from './util';

class ServerDoc extends Doc {
  constructor(collectionName, docId, ops, storage, docSet) {
    super(docId, ops);
    this.collectionName = collectionName;
    this.storage = storage;
    this.docSet = docSet;
    this.prevVersion = null;
    this.loaded = false;
    this.loading = false;
    this.channels = [];

    this.load();
  }

  load() {
    if (this.loading) return;
    this.loading = true;

    //debug('load', this.collectionName, this.docId);

    this.storage
      .getDocById(this.collectionName, this.docId)
      .then((doc) => {
        debug('loaded', this.collectionName, this.docId);
        if (doc) {
          this.applyOps(doc._ops);
          this.prevVersion = doc._v;
        }

        this.loading = false;
        this.loaded = true;
        this.emit('loaded');
      })
      .catch((err) => {
        console.error('ServerDoc.load', err);
      })
  }

  onOp(op, channel) {
    debug('onOp');
    this.applyOp(op);
    this.save();
    this.broadcast();
  }

  save() {
    if (!this.loaded) return;

    debug('save', this.ops.length);

    if (this.ops.length === 0) return;

    let version = this.version();

    this.storage
      .saveDoc(this.collectionName, this.docId, this.prevVersion, version, this.state, this.ops)
      .then(() => {
        this.emit('saved');
        this.prevVersion = version;
        //debug('saved', this.collectionName, this.docId);
      })
      .catch((err) => {
        if (err === 'version changed') {
          this.once('loaded', this.save().bind(this));
          return this.load();
        } else {
          console.error('ServerDoc.save', err);
        }
      });
  }

  broadcast() {
    debug('broadcast', this.channels.length);
    for (let channel of this.channels) {
      this.sendOpsToChannel(channel);
    }
  }

  sendOpsToChannel(channel) {
    let version = channel._session.getDocVersion(this.collectionName, this.docId);
    let opsToSend = this.getOpsToSend(version);

    for (let op of opsToSend) {
      channel.send(op);
    }
  }

  fetch(channel, opId) {
    this.sendOpsToChannel(channel);

    channel.send({
      id: opId,
      type: 'ack'
    });

    this.maybeUnattach();
  }

  subscribe(channel, version) {
    channel._session.subscribeDoc(this.collectionName, this.docId, version);
    this.channels.push(channel);

    this.sendOpsToChannel(channel);

    channel.send({
      type: 'sub',
      collectionName: this.collectionName,
      docId: this.docId,
      version: this.version()
    });
  }

  unsubscribe(channel) {
    util.arrayRemove(this.channels, channel);

    this.maybeUnattach();
  }

  maybeUnattach() {
    // TODO: add timeout
    if (this.channels.length === 0) {
      this.docSet.unattach(this.collectionName, this.docId);
    }
  }

  sync(channel, version, resubscribe) {
    if (resubscribe) {
      channel._session.subscribeDoc(this.collectionName, this.docId, version);
      this.channels.push(channel);
      this.sendOpsToChannel(channel);
    }

    channel.send({
      type: 'sync',
      collectionName: this.collectionName,
      docId: this.docId,
      version: this.version()
    });
  }
}

export default ServerDoc;