// Reuse the standalone form without creating a second page or event channel.
module.exports = function embeddedEntry(definition) {
  const methods = {}
  Object.keys(definition).forEach(key => {
    if (typeof definition[key] === 'function' && !['onLoad', 'onShow', 'onShareAppMessage', 'onShareTimeline'].includes(key)) methods[key] = definition[key]
  })
  methods.getOpenerEventChannel = function () {
    return {
      on: (event, listener) => {
        if (this.properties.config.restore) listener(this.properties.config.restore)
      },
      emit: (event, result) => { if (event === 'calcResult') this.triggerEvent('result', result) }
    }
  }
  return {
    properties: { config: { type: Object, value: {} } },
    data: JSON.parse(JSON.stringify(definition.data)),
    methods,
    lifetimes: {
      attached() {
        this._embedded = true
        definition.onLoad.call(this, this.properties.config.options || {})
      }
    }
  }
}
