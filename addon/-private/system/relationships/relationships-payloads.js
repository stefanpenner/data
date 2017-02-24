import Ember from 'ember';
let get = Ember.get;

/**
  Manages relationship payloads for a given store.  Acts as a single source of
  truth (of payloads) for both sides of a relationship so they can agree on the
  most up-to-date payload received without needing too much eager processing
  when those payloads are pushed into the store.

  @example

    let relationshipsPayloads = new RelationshipsPayloads(store);

    const User = DS.Model.extend({
      hobbies: DS.hasMany('hobby')
    });

    const Hobby = DS.Model.extend({
      user: DS.belongsTo('user')
    });

    let userPayload = {
      data: {
        id: 1,
        type: 'user',
        relationships: {
          hobbies: {
            data: [{
              id: 2,
              type: 'hobby'
            }]
          }
        }
      },
    };
    relationshipsPayloads.push('user', 1, userPayload.data.relationships);

    relationshipsPayloads.get('hobby', 2, 'user') === {
      {
        payload: {
          data: {
            id: 1,
            type: 'user'
          }
        },
        // tells us this payload was populated from the inverse side; so if
        // we're a many side of a relationship we are not fully loaded
        inverse: true,
      }
    }

  @class RelationshipsPayloads
*/
export default class RelationshipsPayloads {
  constructor(store) {
    this._store = store;
    this._map = {};
  }

  /**
    Find the payload for the given relationship of the given model.

    Returns a payload entry which will contain the payload for the given
    relationship and a flag to denote whether this payload was directly pushed
    or computed from an inverse

    @example

      relationshipsPayloads.get('hobby', 2, 'user') === {
        {
          payload: {
            data: {
              id: 1,
              type: 'user'
            }
          },
          // tells us this payload was populated from the inverse side; so if
          // we're a many side of a relationship we are not fully loaded
          inverse: true,
        }
      }

  */
  get(modelName, id, relationshipName) {
    let relationshipPayloads = this._getRelationshipPayloads(modelName, relationshipName);
    return relationshipPayloads && relationshipPayloads.get(modelName, id, relationshipName);
  }

  /**
    Push a model's relationships payload into this cache.

    @example

      let userPayload = {
        data: {
          id: 1,
          type: 'user',
          relationships: {
            hobbies: {
              data: [{
                id: 2,
                type: 'hobby'
              }]
            }
          }
        },
      };
      relationshipsPayloads.push('user', 1, userPayload.data.relationships);
  */
  push(modelName, id, relationshipsData) {
    if (!relationshipsData) { return; }

    for (let key in relationshipsData) {
      let relationshipPayloads = this._getRelationshipPayloads(modelName, key);
      if (relationshipPayloads) {
        relationshipPayloads.push(modelName, id, key, relationshipsData[key]);
      }
    }
  }

  unload(modelName, id) {
    let modelClass = this._store.modelFor(modelName);
    let relationshipsByName = get(modelClass, 'relationshipsByName');
    relationshipsByName.forEach((_, relationshipName) => {
      let relationshipPayloads = this._getRelationshipPayloads(modelName, relationshipName);
      if (relationshipPayloads) {
        relationshipPayloads.unload(modelName, id, relationshipName);
      }
    });
  }

  /**
    Find the RelationshipPayloads object for the given relationship.  The same
    RelationshipPayloads object is returned for either side of a relationship.

    @example

      const User = DS.Model.extend({
        hobbies: DS.hasMany('hobby')
      });

      const Hobby = DS.Model.extend({
        user: DS.belongsTo('user')
      });

      relationshipPayloads.get('user', 'hobbies') === relationshipPayloads.get('hobby', 'user');

    @private
  */
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
      this._map[key] = new RelationshipPayloads(this._store, keyPart1, keyPart2);
    }
    return this._map[key];
  }

  /**
    Find the invese of a given relationship.

    @return {[String, String]} A tuple of the inverse model and inverse relationship names
  */
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


/**
  Manages the payloads for both sides of a single relationship, across all model
  instances.

  The "key" for one side of a relationship is given by
  `${modelName}:${relationshipName}`.

  For example, with

    const User = DS.Model.extend({
      hobbies: DS.hasMany('hobby')
    });

    const Hobby = DS.Model.extend({
      user: DS.belongsTo('user')
    });

    let key1 = "user:hobbies";
    let key2 = "hobby:user";
    let relationshipPayloads = new RelationshipPayloads(key1, key2);

    let userPayload = {
      data: {
        id: 1,
        type: 'user',
        relationships: {
          hobbies: {
            data: [{
              id: 2,
              type: 'hobby',
            }]
          }
        }
      }
    };

    // here we expect the payload of the individual relationship
    relationshipPayloads.push('user', 1, 'hobbies', userPayload.data.relationships.hobbies);

    relationshipPayloads.get('user', 1, 'hobbies');
    relationshipPayloads.get('hobby', 2, 'user');

  @class RelationshipPayloads
  @private
*/
class RelationshipPayloads {
  constructor(store, key1, key2) {
    this._store = store;
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
    if (key === this._lhsKey) {
      return this._lhsPayloads[id];
    } else {
      return this._rhsPayloads[id];
    }
  }

  push(modelName, id, relationshipName, relationshipData) {
    this._pendingPayloads.push([modelName, id, relationshipName, relationshipData]);
  }

  unload(modelName, id, relationshipName) {
    this._flushPending();

    let key = `${modelName}:${relationshipName}`;
    if (key === this._lhsKey) {
      this._unload(id, this._lhsPayloads, this._rhsPayloads);
    } else {
      this._unload(id, this._rhsPayloads, this._lhsPayloads);
    }
  }

  _unload(id, payloads, inversePayloads) {
    if (!this._inverseLoaded(payloads[id])) {
      this._removeInverse(id, payloads[id], inversePayloads);
      delete payloads[id];
    }
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
        this._removeInverse(id, this._lhsPayloads[id], this._rhsPayloads);
        this._lhsPayloads[id] = entry;
        this._populateInverse(relationshipData, inverseEntry, this._rhsPayloads);
      } else {
        this._removeInverse(id, this._rhsPayloads[id], this._lhsPayloads);
        this._rhsPayloads[id] = entry;
        this._populateInverse(relationshipData, inverseEntry, this._lhsPayloads);
      }
    }
  }

  _inverseLoaded(entry) {
    let data = entry && entry.payload && entry.payload.data;
    if (!data) { return false; }

    if (Array.isArray(data)) {
      for (let i=0; i<data.length; ++i) {
        if (this._store.hasRecordForId(data[i].type, data[i].id)) {
          return true;
        }
      }
      return false;
    } else {
      return this._store.hasRecordForId(data.type, data.id);
    }
  }

  _populateInverse(relationshipData, inverseEntry, inversePayloads) {
    if (!relationshipData.data) { return; }

    if (Array.isArray(relationshipData.data)) {
      for (let i=0; i<relationshipData.data.length; ++i) {
        let inverseId = relationshipData.data[i].id;
        this._addToInverse(inverseEntry, inverseId, inversePayloads);
      }
    } else {
      let inverseId = relationshipData.data.id;
      this._addToInverse(inverseEntry, inverseId, inversePayloads);
    }
  }

  _addToInverse(inverseEntry, inverseId, inversePayloads) {
    let existingEntry = inversePayloads[inverseId];
    let existingData = existingEntry && existingEntry.payload && existingEntry.payload.data;

    // If there is no existing data, it would make a certain amount of sense for
    // us to set the inverse payload to an array if the inverse side of the
    // relationship is a many.  We could do this by changing this logic to
    // something that checked the schema.  It's not necessary at the moment,
    // because to-many relationships that receive inverse payloads ignore them,
    // as we don't yet support sparse many relationships.
    if (Array.isArray(existingData)) {
      existingData.push(inverseEntry.payload.data);
    } else {
      inversePayloads[inverseId] = inverseEntry;
    }
  }

  // TODO: diff rather than removeall addall?
  _removeInverse(id, entry, inversePayloads) {
    let data = entry && entry.payload && entry.payload.data;
    if (!data) { return; }

    if (Array.isArray(data)) {
      for (let i=0; i<data.length; ++i) {
        this._removeFromInverse(id, data[i].id, inversePayloads);
      }
    } else {
      this._removeFromInverse(id, data.id, inversePayloads);
    }
  }

  _removeFromInverse(id, inverseId, inversePayloads) {
    let inverseEntry = inversePayloads[inverseId];
    let data = inverseEntry && inverseEntry.payload && inverseEntry.payload.data;

    if (!data) { return; }

    if (Array.isArray(data)) {
      inverseEntry.payload.data = data.filter((x) => x.id !== id);
    } else {
      inversePayloads[inverseId] = {
        payload: { data: null },
        inverse: true
      };
    }
  }
}
