const Reports = require('./battle-report')

// Shared by the standalone settlement page and the history drawer.
module.exports = {
  copy() {
    if (!this.data.report) return
    wx.setClipboardData({ data: Reports.text(this.data.report),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) })
  },
  preview() {
    if (!this.data.report) return
    wx.navigateTo({ url: '/pages/battle-report/battle-report?id=' + encodeURIComponent(this.data.report.id) })
  }
}
