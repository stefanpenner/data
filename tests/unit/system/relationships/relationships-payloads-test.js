import RelationshipsPayloads from 'ember-data/-private/system/relationships/relationships-payloads';
import DS from 'ember-data';
import {createStore} from 'dummy/tests/helpers/store';
import {module, test} from 'qunit';

module('unit/system/relationships/relationships-payloads', {
  beforeEach() {
    const User = DS.Model.extend({
      purpose: DS.belongsTo('purpose', { inverse: 'user' }),
      hobbies: DS.hasMany('hobby', { inverse: 'user'}),
      friends: DS.hasMany('user', { inverse: 'friends' })
    });
    User.toString = () => 'User';

    const Hobby = DS.Model.extend({
      user: DS.belongsTo('user', { inverse: 'hobbies' })
    });
    Hobby.toString = () => 'Hobby';

    const Purpose = DS.Model.extend({
      user: DS.belongsTo('user', { inverse: 'purpose' })
    });
    Purpose.toString = () => 'Purpose';

    let store = this.store = createStore({
      user: User,
      Hobby: Hobby,
      purpose: Purpose
    });

    this.relationshipsPayloads = new RelationshipsPayloads(store);
  }
});


test('get throws for invalid models', function(assert) {
  this.relationshipsPayloads._store._modelFor = (name) => {
    if (name === 'fish') {
      throw new Error('What is fish?');
    }
  }

  assert.throws(() => {
    this.relationshipsPayloads.get('fish', 9, 'hobbies');
  }, /What is fish/);
});

test('get returns null for invalid relationships', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    hobbies: {
      data: [{
        id: 1,
        type: 'hobby'
      }]
    }
  });
  let entry = this.relationshipsPayloads.get('user', 2, 'potatoes');
  assert.equal(entry, null, 'nothing returned for invalid relationship');
});

test('get reuturns null if there are no payloads', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    hobbies: {
      data: [{
        id: 1,
        type: 'hobby'
      }]
    }
  });
  let entry = this.relationshipsPayloads.get('user', 2, 'hobbies');
  assert.equal(entry, null, 'no payloads for user 2');

  entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.equal(entry, null, 'no payloads for user 1 purpose');
});

test('get returns direct payloads', function(assert) {
  let hobbyPayload = {
    data: [{
      id: 1,
      type: 'hobby'
    }]
  };
  let purposePayload = {
    data: {
      id: 2,
      type: 'purpose'
    }
  };
  let friendsPayload = {
    data: [{
      id: 2,
      type: 'user'
    }, {
      id: 3,
      type: 'user'
    }]
  };
  this.relationshipsPayloads.push('user', 1, {
    hobbies: hobbyPayload,
    purpose: purposePayload,
    friends: friendsPayload
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: purposePayload,
    inverse: false
  }, 'direct one-to-one payload loaded');

  entry = this.relationshipsPayloads.get('user', 1, 'hobbies');
  assert.deepEqual(entry, {
    payload: hobbyPayload,
    inverse: false
  }, 'direct one-to-many payload loaded');

  entry = this.relationshipsPayloads.get('user', 1, 'friends');
  assert.deepEqual(entry, {
    payload: friendsPayload,
    inverse: false
  }, 'direct many-to-many payload loaded');
});

test('get returns inverse payloads one-to-one', function(assert) {
  this.relationshipsPayloads.push('purpose', 2, {
    user: {
      data: {
        id: 1,
        type: 'user'
      }
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 2,
        type: 'purpose'
      }
    },
    inverse: true
  }, 'inverse one-to-one payload loaded');
});

test('get returns inverse payloads one-to-many', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    hobbies: {
      data: [{
        id: 2,
        type: 'hobby'
      }, {
        id: 3,
        type: 'hobby'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('hobby', 2, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'inverse one-to-many payload loaded');

  entry = this.relationshipsPayloads.get('hobby', 3, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'inverse one-to-many payload loaded');
});

test('get handles inverse payloads that unset one-to-one', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    purpose: {
      data: {
        id: 2,
        type: 'purpose'
      }
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 2,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'user.purpose.id is initially 2');

  entry = this.relationshipsPayloads.get('purpose', 2, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'purpose.user.id is initially 1');

  this.relationshipsPayloads.push('purpose', 2, {
    user: {
      data: null
    }
  });

  entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: null
    },
    inverse: true
  }, 'inverse payload unset one-to-one');
});

test('get handles inverse payloads that change one-to-one', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    purpose: {
      data: {
        id: 2,
        type: 'purpose'
      }
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 2,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'user.purpose.id is initially 2');

  entry = this.relationshipsPayloads.get('purpose', 2, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'purpose.user.id is initially 1');

  this.relationshipsPayloads.push('purpose', 2, {
    user: {
      data: {
        id: 2,
        type: 'user'
      }
    }
  });

  entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: null
    },
    inverse: true
  }, 'inverse payload unset one-to-one');

  entry = this.relationshipsPayloads.get('user', 2, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 2,
        type: 'purpose'
      }
    },
    inverse: true
  }, 'inverse payload changed one-to-one');
});

test('get handles inverse payloads that remove one-to-many', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    hobbies: {
      data: [{
        id: 2,
        type: 'hobby'
      }, {
        id: 3,
        type: 'hobby'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'hobbies');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'hobby'
      }, {
        id: 3,
        type: 'hobby'
      }]
    },
    inverse: false
  }, 'user.hobbies.ids is initially 2,3');

  entry = this.relationshipsPayloads.get('hobby', 2, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'hobby(2).user.id is initially 1');

  entry = this.relationshipsPayloads.get('hobby', 3, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'hobby(3).user.id is initially 1');

  this.relationshipsPayloads.push('hobby', 2, {
    user: {
      data: null
    }
  });

  entry = this.relationshipsPayloads.get('user', 1, 'hobbies');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 3,
        type: 'hobby'
      }]
    },
    inverse: false
  }, 'inverse payload removes from one-to-many');
});

test('get handles inverse payloads that add one-to-many', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    hobbies: {
      data: [{
        id: 2,
        type: 'hobby'
      }, {
        id: 3,
        type: 'hobby'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'hobbies');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'hobby'
      }, {
        id: 3,
        type: 'hobby'
      }]
    },
    inverse: false
  }, 'user.hobbies.ids is initially 2,3');

  entry = this.relationshipsPayloads.get('hobby', 2, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'hobby(2).user.id is initially 1');

  entry = this.relationshipsPayloads.get('hobby', 3, 'user');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    inverse: true
  }, 'hobby(3).user.id is initially 1');

  this.relationshipsPayloads.push('hobby', 4, {
    user: {
      data: {
        id: 1,
        type: 'user'
      }
    }
  });

  entry = this.relationshipsPayloads.get('user', 1, 'hobbies');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'hobby'
      }, {
        id: 3,
        type: 'hobby'
      }, {
        id: 4,
        type: 'hobby'
      }]
    },
    inverse: false
  }, 'inverse payload adds to one-to-many');
});

test('get handles inverse payloads that remove many-to-many', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    friends: {
      data: [{
        id: 2,
        type: 'user'
      }, {
        id: 3,
        type: 'user'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'friends');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'user'
      }, {
        id: 3,
        type: 'user'
      }]
    },
    inverse: false
  }, 'user.friends.ids is initially 2,3');

  this.relationshipsPayloads.push('user', 3, {
    friends: {
      data: []
    }
  });

  entry = this.relationshipsPayloads.get('user', 1, 'friends');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'user'
      }]
    },
    inverse: false
  }, 'inverse payload removes from many-to-many');
});

test('get handles inverse payloads that add many-to-many', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    friends: {
      data: [{
        id: 2,
        type: 'user'
      }, {
        id: 3,
        type: 'user'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'friends');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'user'
      }, {
        id: 3,
        type: 'user'
      }]
    },
    inverse: false
  }, 'user.friends.ids is initially 2,3');

  this.relationshipsPayloads.push('user', 4, {
    friends: {
      data: [{
        id: 1,
        type: 'user'
      }]
    }
  });

  entry = this.relationshipsPayloads.get('user', 1, 'friends');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'user'
      }, {
        id: 3,
        type: 'user'
      }, {
        id: 4,
        type: 'user'
      }]
    },
    inverse: false
  }, 'inverse payload adds to many-to-many');
});

test('push populates the same RelationshipPayloads for either side of a relationship', function(assert) {

  this.relationshipsPayloads.push('user', 1, {
    hobbies: [{
      id: 2,
      type: 'hobby'
    }]
  });

  let userPayloads = this.relationshipsPayloads._getRelationshipPayloads('user', 'hobbies');
  let hobbyPayloads = this.relationshipsPayloads._getRelationshipPayloads('hobby', 'user');

  assert.equal(userPayloads, hobbyPayloads, 'both sides of a relationship share a RelationshipPayloads');
});

test('push does not eagerly populate inverse payloads', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    hobbies: {
      data: [{
        id: 2,
        type: 'hobby'
      }]
    }
  });

  let relationshipPayloads = this.relationshipsPayloads._getRelationshipPayloads('user', 'hobbies');

  assert.deepEqual(
    Object.keys(relationshipPayloads._lhsPayloads),
    [] ,
    'user.hobbies payloads not eagerly populated'
  );
  assert.deepEqual(
    Object.keys(relationshipPayloads._rhsPayloads),
    [] ,
    'hobby.user payloads not eagerly populated'
    );

  relationshipPayloads.get('user', 1, 'hobbies');

  assert.deepEqual(
    Object.keys(relationshipPayloads._lhsPayloads),
    ['1'] ,
    'user.hobbies payloads lazily populated'
  );
  assert.deepEqual(
    Object.keys(relationshipPayloads._rhsPayloads),
    ['2'] ,
    'hobby.user payloads lazily populated'
    );
});

test('push populates each individual relationship in a payload', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    purpose: {
      data: {
        id: 3,
        type: 'purpose'
      }
    },
    friends: {
      data: [{
        id: 3,
        type: 'user'
      }]
    },
    hobbies: {
      data: [{
        id: 2,
        type: 'hobby'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 3,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'user.purpose is loaded');

  entry = this.relationshipsPayloads.get('user', 1, 'friends');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 3,
        type: 'user'
      }]
    },
    inverse: false
  }, 'user.friends is loaded');

  entry = this.relationshipsPayloads.get('user', 1, 'hobbies');
  assert.deepEqual(entry, {
    payload: {
      data: [{
        id: 2,
        type: 'hobby'
      }]
    },
    inverse: false
  }, 'user.hobbies is loaded');
});

test('push ignores invalid relationships in a payload', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    purpose: {
      data: {
        id: 3,
        type: 'purpose'
      }
    },
    loyalBadgers: {
      data: [{
        id: 1,
        type: 'badger-obviously'
      }, {
        id: 2,
        type: 'badger-obviously'
      }]
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 3,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'user.purpose is loaded');
});

test('unload unloads payloads that have no inverse', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    purpose: {
      data: {
        id: 1,
        type: 'purpose'
      }
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'payload is initially loaded');

  this.relationshipsPayloads.unload('user', 1, 'purpose');

  entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.equal(entry, null, 'payload is unloaded when inverse is not in store');
});

test('unload unloads payloads with inverse only when if the inverse is already unloaded', function(assert) {
  this.relationshipsPayloads.push('user', 1, {
    purpose: {
      data: {
        id: 1,
        type: 'purpose'
      }
    }
  });

  let entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'payload is initially loaded');

  this.store.hasRecordForId = (modelName, id) => {
    return modelName === 'purpose' && (id+'') === '1';
  }

  this.relationshipsPayloads.unload('user', 1, 'purpose');

  entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.deepEqual(entry, {
    payload: {
      data: {
        id: 1,
        type: 'purpose'
      }
    },
    inverse: false
  }, 'payload is not unloaded while inverse remains in store');

  this.store.hasRecordForId = () => false;

  this.relationshipsPayloads.unload('user', 1, 'purpose');

  entry = this.relationshipsPayloads.get('user', 1, 'purpose');
  assert.equal(entry, null, 'payload is unloaded when inverse is not in store');
});
