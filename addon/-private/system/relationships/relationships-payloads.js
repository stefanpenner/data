import Ember from 'ember';
let get = Ember.get;

export default class RelationshipsPayloads {
  constructor(store) {
    this._store = store;
    this._map = {};
  }

  get(modelName, id, relationshipName) {
    let relationshipPayloads = this._getRelationshipPayloads(modelName, relationshipName);
    return relationshipPayloads && relationshipPayloads.get(modelName, id, relationshipName);
  }

  push(modelName, id, relationshipsData) {
    if (!relationshipsData) { return; }

    for (let key in relationshipsData) {
      let relationshipPayloads = this._getRelationshipPayloads(modelName, key);
      if (relationshipPayloads) {
        relationshipPayloads.push(modelName, id, key, relationshipsData[key]);
      }
    }
  }

  _getRelationshipPayloads(modelName, relationshipName) {
    // TODO: lightschema this
    let modelClass = this._store._modelFor(modelName);
    let relationshipsByName = get(modelClass, 'relationshipsByName');
    if (!relationshipsByName.has(relationshipName)) {
      return;
    }

    let inverse = this._inverseFor(modelName, relationshipName);
    let inverseModelName = inverse[0];
    let inverseRelationshipName = inverse[1];
    let keyPart1 = `${modelName}:${relationshipName}`;
    let keyPart2 = `${inverseModelName}:${inverseRelationshipName}`;
    let key = (keyPart1 < keyPart2) ? `${keyPart1}:${keyPart2}` : `${keyPart2}:${keyPart1}`;

    if (!this._map[key]) {
      this._map[key] = new RelationshipPayloads(keyPart1, keyPart2);
    }
    return this._map[key];
  }

  _inverseFor(modelName, relationshipName) {
    // TODO: lightschema this
    let modelClass = this._store._modelFor(modelName);
    let relationshipsByName = get(modelClass, 'relationshipsByName');
    if (!relationshipsByName.has(relationshipName)) {
      return;
    }

    let inverseData = modelClass.inverseFor(relationshipName, this._store);
    if (!inverseData) {
      return ['', ''];
    }

    let relationshipMeta = relationshipsByName.get(relationshipName);
    let inverseModelName = relationshipMeta.type;
    let inverseRelationshipName = inverseData.name
    return [inverseModelName, inverseRelationshipName];
  }
}

class RelationshipPayloads {
  constructor(key1, key2) {
    this._lhsKey = key1;
    this._rhsKey = key2;

    this._lhsPayloads = {};
    if (key1 !== key2) {
      this._rhsPayloads = {};
    } else {
      this._rhsPayloads = this._lhsPayloads;
    }

    // either canoical on push or pending & flush
    this._pendingPayloads = [];
  }

  get(modelName, id, relationshipName) {
    this._flushPending();

    let key = `${modelName}:${relationshipName}`;
    // TODO: return { payload: payload, inverse: true|false }
    if (key === this._lhsKey) {
      return this._lhsPayloads[id];
    } else {
      return this._rhsPayloads[id];
    }
  }

  push(modelName, id, relationshipName, relationshipData) {
    let key = `${modelName}:${relationshipName}`;
    if (key === this._lhsKey) {
      this._lhsPayloads[id] = relationshipData;
    } else {
      this._rhsPayloads[id] = relationshipData;
    }

    this._pendingPayloads.push([modelName, id, relationshipName, relationshipData]);
  }

  _flushPending() {
    let work = this._pendingPayloads.splice(0, this._pendingPayloads.length);
    for (let i=0; i<work.length; ++i) {
      let modelName = work[i][0];
      let id = work[i][1];
      let relationshipName = work[i][2];
      let relationshipData = work[i][3];
      let key = `${modelName}:${relationshipName}`;

      let entry = {
        payload: relationshipData,
        inverse: false
      };
      let inverseEntry = {
        payload: {
          data: {
            id: id,
            type: modelName
          }
        },
        inverse: true
      }
      if (key === this._lhsKey) {
        // TODO: we remove without checking the new payload; this is fine for
        // arrays; for belongsTo the previous semantics were specifically that
        // `null` meant clear out; however i think we're good b/c the transport
        // is json and there is no way to distinguish key-present value
        // undefined vs null
        this._removeInverse(this._lhsPayloads[id], this._rhsPayloads);
        this._lhsPayloads[id] = entry;
        this._populateInverse(relationshipData, inverseEntry, this._rhsPayloads);
      } else {
        this._removeInverse(this._rhsPayloads[id], this._lhsPayloads);
        this._rhsPayloads[id] = entry;
        this._populateInverse(relationshipData, inverseEntry, this._lhsPayloads);
      }
    }
  }

  _populateInverse(relationshipData, inverseEntry, inversePayloads) {
    if (!relationshipData.data) { return; }

    if (Array.isArray(relationshipData.data)) {
      for (let i=0; i<relationshipData.data.length; ++i) {
        let inverseId = relationshipData.data[i].id;
        inversePayloads[inverseId] = inverseEntry;
      }
    } else {
      let inverseId = relationshipData.data.id;
      inversePayloads[inverseId] = inverseEntry;
    }
  }

  // TODO: diff rather than removeall addall?
  _removeInverse(entry, inversePayloads) {
    let data = entry && entry.payload && entry.payload.data;
    if (!data) { return; }

    if (Array.isArray(data)) {
      for (let i=0; i<data.length; ++i) {
        let inverseId = data[i].id;
        inversePayloads[inverseId] = {
          payload: { data: null },
          inverse: true
        };
      }
    } else {
      let inverseId = data.id;
      inversePayloads[inverseId] = {
        payload: { data: null },
        inverse: true
      };
    }
  }
}
