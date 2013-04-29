require("ember-data/core");
require("ember-data/system/adapter");
require('ember-data/serializers/fixture_serializer');

/**
  @module data
  @submodule data-adapters
*/

var get = Ember.get, fmt = Ember.String.fmt, Promise = Ember.RSVP.Promise,
    dump = Ember.get(window, 'JSON.stringify') || function(object) { return object.toString(); };

/**
  `DS.FixtureAdapter` is an adapter that loads records from memory.
  Its primarily used for development and testing. You can also use
  `DS.FixtureAdapter` while working on the API but are not ready to
  integrate yet. It is a fully functioning adapter. All CRUD methods
  are implemented. You can also implement query logic that a remote
  system would do. Its possible to do develop your entire application
  with `DS.FixtureAdapter`.

  @class FixtureAdapter
  @constructor
  @namespace DS
  @extends DS.Adapter
*/
DS.FixtureAdapter = DS.Adapter.extend({

  simulateRemoteResponse: true,

  latency: 50,

  serializer: DS.FixtureSerializer,

  /*
    Implement this method in order to provide data associated with a type
  */
  fixturesForType: function(type) {
    if (type.FIXTURES) {
      var fixtures = Ember.A(type.FIXTURES);
      return fixtures.map(function(fixture){
        if(!fixture.id){
          throw new Error(fmt('the id property must be defined for fixture %@', [dump(fixture)]));
        }
        fixture.id = fixture.id + '';
        return fixture;
      });
    }
    return null;
  },

  /*
    Implement this method in order to query fixtures data
  */
  queryFixtures: function(fixtures, query, type) {
    Ember.assert('Not implemented: You must override the DS.FixtureAdapter::queryFixtures method to support querying the fixture store.');
  },

  updateFixtures: function(type, fixture) {
    if(!type.FIXTURES) {
      type.FIXTURES = [];
    }

    var fixtures = type.FIXTURES;

    this.deleteLoadedFixture(type, fixture);

    fixtures.push(fixture);
  },

  /*
    Implement this method in order to provide provide json for CRUD methods
  */
  mockJSON: function(type, record) {
    return this.serialize(record, { includeId: true });
  },

  /*
    Adapter methods
  */
  generateIdForRecord: function(store, record) {
    return Ember.guidFor(record);
  },

  find: function(store, type, id) {
    var fixtures = this.fixturesForType(type),
        fixture, self = this;

    Ember.assert("Unable to find fixtures for model type " + type.toString(), !!fixtures);

    return new Promise(function(resolve, reject) {
      if (fixtures) {
        fixture = Ember.A(fixtures).findProperty('id', id);
      }

      if (fixture) {
        self.simulateRemoteCall(function() {
          self.didFindRecord(store, type, fixture, id);
          resolve(fixture);
        }, self);
      } else {
        reject(fixture);
      }
    });

  },

  findMany: function(store, type, ids) {
    var fixtures = this.fixturesForType(type), self = this;

    Ember.assert("Unable to find fixtures for model type " + type.toString(), !!fixtures);

    return new Promise(function(resolve, reject) {
      if (fixtures) {
        fixtures = fixtures.filter(function(item) {
          return ids.indexOf(item.id) !== -1;
        });
      }

      if (fixtures) {
        self.simulateRemoteCall(function() {
          self.didFindMany(store, type, fixtures);
          resolve(fixtures);
        }, self);
      } else {
        reject(fixtures);
      }
    });
  },

  findAll: function(store, type) {
    var fixtures = this.fixturesForType(type), self = this;

    Ember.assert("Unable to find fixtures for model type " + type.toString(), !!fixtures);

    return new Promise(function(resolve) {
      self.simulateRemoteCall(function() {
        self.didFindAll(store, type, fixtures);
        resolve(fixtures);
      }, self);
    });
  },

  findQuery: function(store, type, query, array) {
    var fixtures = this.fixturesForType(type), self = this;

    Ember.assert("Unable to find fixtures for model type " + type.toString(), !!fixtures);

    fixtures = self.queryFixtures(fixtures, query, type);

    return new Promise(function(resolve, reject) {

      if (fixtures) {
        self.simulateRemoteCall(function() {
          self.didFindQuery(store, type, fixtures, array);
          resolve(fixtures);
        }, self);
      } else {
        reject(fixtures);
      }
    });
  },

  createRecord: function(store, type, record) {
    var fixture = this.mockJSON(type, record), self = this;
    return new Promise(function(resolve) {
      self.updateFixtures(type, fixture);

      self.simulateRemoteCall(function() {
        self.didCreateRecord(store, type, record, fixture);
        resolve(fixture);
      }, self);
    });
  },

  updateRecord: function(store, type, record) {
    var fixture = this.mockJSON(type, record), self = this;
    return new Promise(function(resolve) {
      self.updateFixtures(type, fixture);

      self.simulateRemoteCall(function() {
        self.didUpdateRecord(store, type, record, fixture);
        resolve(fixture);
      }, self);
    });
  },

  deleteRecord: function(store, type, record) {
    var fixture = this.mockJSON(type, record), self = this;
    return new Promise(function(resolve) {
      self.deleteLoadedFixture(type, fixture);

      self.simulateRemoteCall(function() {
        self.didDeleteRecord(store, type, record);
        resolve(null);
      }, self);
    });
  },

  /*
    @private
  */
 deleteLoadedFixture: function(type, record) {
    var existingFixture = this.findExistingFixture(type, record);

    if(existingFixture) {
      var index = type.FIXTURES.indexOf(existingFixture);
      type.FIXTURES.splice(index, 1);
      return true;
    }
  },

  findExistingFixture: function(type, record) {
    var fixtures = this.fixturesForType(type);
    var id = this.extractId(type, record);

    return this.findFixtureById(fixtures, id);
  },

  findFixtureById: function(fixtures, id) {
    return Ember.A(fixtures).find(function(r) {
      if(''+get(r, 'id') === ''+id) {
        return true;
      } else {
        return false;
      }
    });
  },

  simulateRemoteCall: function(callback, context) {
    if (get(this, 'simulateRemoteResponse')) {
      // Schedule with setTimeout
      Ember.run.later(context, callback, get(this, 'latency'));
    } else {
      // Asynchronous, but at the of the runloop with zero latency
      Ember.run.once(context, callback);
    }
  }
});
