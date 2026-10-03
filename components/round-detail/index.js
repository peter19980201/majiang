const definition = require('../../pages/game/round-detail-definition')
Component({
  properties: { record: { type: Object, value: null, observer() { this.setData({ busy: false }) } } },
  data: { busy: false },
  lifetimes: { attached() { this._embedded = true } },
  methods: {
    _returnWithAction: definition._returnWithAction,
    editRecord: definition.editRecord,
    deleteRecord: definition.deleteRecord
  }
})
