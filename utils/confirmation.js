// Use the page's top-level dialog, including requests from embedded detail components.
function show(host, options) {
  let dialog = host && typeof host.selectComponent === 'function' && host.selectComponent('#confirmation-dialog')
  if (!dialog && typeof getCurrentPages === 'function') {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    dialog = page && typeof page.selectComponent === 'function' && page.selectComponent('#confirmation-dialog')
  }
  if (dialog) return dialog.show(options)
  const error = { errMsg:'confirmation:fail dialog unavailable' }
  try { if (options.fail) options.fail(error) } finally { if (options.complete) options.complete(error) }
}
function showCurrent(options) { return module.exports.show(null, options) }
module.exports = { show, showCurrent }
