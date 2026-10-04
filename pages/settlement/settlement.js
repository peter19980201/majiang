const GameStorage = require('../../utils/game-storage')
const { withShare } = require('../../utils/share')
const Reports = require('../../utils/battle-report')
const reportActions = require('../../utils/report-actions')
Page(withShare({
  data: { report: null },
  onLoad(options) { this._id = options.id },
  onShow() {
    const record = GameStorage.history().find(r => String(r.id) === String(this._id))
    if (!record) { wx.showToast({ title: '未找到这场对局', icon: 'none' }); return }
    const report = Reports.build(record)
    this.setData({ report })
  },
  ...reportActions
}))
