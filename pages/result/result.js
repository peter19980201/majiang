const { withShare } = require('../../utils/share')
const T = require('../../utils/tiles')

Page(withShare({
  data: {
    result: null,
    showFuDetail: false,
    windNames: { 27: '東', 28: '南', 29: '西', 30: '北' },
    meldTypeNames: { chi: '吃', pon: '碰', minkan: '明杠', ankan: '暗杠', kakan: '加杠' }
  },

  onLoad(options) {
    if (options.data) {
      const result = JSON.parse(decodeURIComponent(options.data))
      const payment = result.payment
      const fmt = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      const paymentRows = payment.type === 'tsumo_ko'
        ? [{ label:'庄家支付', value:fmt(payment.oyaPayment) },{ label:'闲家各付', value:fmt(payment.koPayment) }]
        : [{ label:payment.type === 'tsumo_oya' ? '三家各付' : '放铳者支付', value:fmt(payment.type === 'tsumo_oya' ? payment.koPayment : payment.total) }]
      this.setData({ result, totalDisplay:fmt(payment.total), paymentRows })
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
}))
