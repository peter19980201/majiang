// Keep existing business assertions while substituting only dialog presentation.
require('../../utils/confirmation').show = (host, options) => wx.showModal(options)
