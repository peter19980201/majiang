const GameStorage = require('../../utils/game-storage')
const { withShare } = require('../../utils/share')
const Reports = require('../../utils/battle-report')
const reportActions = require('../../utils/report-actions')
Page(withShare({
  data: { report: null, celebrate:false },
  onLoad(options) { this._id = options.id; this._fromBoard = options.source === 'board' },
  onShow() {
    const record = GameStorage.history().find(r => String(r.id) === String(this._id))
    if (!record) { wx.showToast({ title: '未找到这场对局', icon: 'none' }); return }
    const report = Reports.build(record)
    this.setData({ report, celebrate:!!this._fromBoard && !this._shown })
    this._shown = true
  },
  ...reportActions
}))
