// Shared forms expose initialize/restore/submit interfaces. Only the host handles navigation.
module.exports = function embeddedEntry(definition) {
  const methods = {}
  Object.keys(definition).forEach(key => {
    if (typeof definition[key] === 'function' && !['onLoad', 'onShow', 'onShareAppMessage', 'onShareTimeline'].includes(key)) methods[key] = definition[key]
  })
  methods.submitResult = function (result) { this.triggerEvent('result', result) }
  methods.dismissInput = function () { this.triggerEvent('dismiss') }
  return {
    properties: { config: { type: Object, value: {} } },
    data: JSON.parse(JSON.stringify(definition.data)),
    methods,
    lifetimes: {
      attached() {
        const { options = {}, restore } = this.properties.config
        this.initializeInput(options)
        if (restore) this.restoreInput(restore)
      }
    }
  }
}
