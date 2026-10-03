const { withShare } = require('../../utils/share')
const Reports = require('../../utils/battle-report')
Page(withShare({
  data: { report: null, rankLabels: ['一位', '二位', '三位', '四位'] },
  onLoad(options) { this._id = options.id },
  onShow() {
    const record = (wx.getStorageSync('gameHistory') || []).find(r => String(r.id) === String(this._id))
    if (!record) { wx.showToast({ title: '未找到这场对局', icon: 'none' }); return }
    const report = Reports.build(record)
    this.setData({ report })
  },
  copy() { if (this.data.report) wx.setClipboardData({ data: Reports.text(this.data.report) }) },
  preview() { wx.navigateTo({ url: `/pages/battle-report/battle-report?id=${encodeURIComponent(this._id)}` }) }
}))
