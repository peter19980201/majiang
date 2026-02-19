const T = require('../../utils/tiles')

Page({
  data: {
    result: null,
    showFuDetail: false,
    windNames: { 27: '東', 28: '南', 29: '西', 30: '北' },
    meldTypeNames: { chi: '吃', pon: '碰', minkan: '明杠', ankan: '暗杠', kakan: '加杠' }
  },

  onLoad(options) {
    if (options.data) {
      const result = JSON.parse(decodeURIComponent(options.data))
      this.setData({ result })
    }
  },

  toggleFuDetail() {
    this.setData({ showFuDetail: !this.data.showFuDetail })
  },

  goBack() {
    wx.navigateBack()
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
