const GameStorage = require('../../utils/game-storage')
const { withShare } = require('../../utils/share')
const Reports = require('../../utils/battle-report')
const Painter = require('../../utils/battle-report-canvas')
Page(withShare({
  data: { report: null, imagePath: '', error: '', loading: true, saving: false },
  onLoad(options) { this._id = options.id },
  onReady() { this.generate() },
  generate() {
    const record = GameStorage.history().find(r => String(r.id) === String(this._id))
    if (!record) { this.setData({ error: '未找到这场对局，请返回历史记录重新打开', loading: false, imagePath: '', report: null }); return }
    const report = Reports.build(record)
    this.setData({ report, loading: true, error: '', imagePath: '' })
    wx.createSelectorQuery().in(this).select('#reportCanvas').fields({ node: true }).exec(res => {
      const canvas = res[0] && res[0].node
      if (!canvas) { this.setData({ error: '画布加载失败，请重试', loading: false }); return }
      canvas.width = Painter.WIDTH * 2; canvas.height = Painter.HEIGHT * 2
      const ctx = canvas.getContext('2d'); ctx.scale(2, 2)
      const render = artwork => {
        Painter.draw(ctx, report, artwork)
        wx.canvasToTempFilePath({ canvas, fileType: 'png',
          success: r => this.setData({ imagePath: r.tempFilePath, loading: false }),
          fail: () => this.setData({ error: '图片生成失败，请重试', loading: false }) }, this)
      }
      const art = canvas.createImage()
      art.onload = () => render(art)
      art.onerror = () => render(null)
      art.src = '/assets/report/poster-paper.jpg'
    })
  },
  save() {
    if (!this.data.imagePath || this.data.saving) return
    this.setData({ saving: true })
    wx.saveImageToPhotosAlbum({ filePath: this.data.imagePath,
      success: () => wx.showToast({ title: '已保存到相册' }),
      fail: err => {
        const denied = /auth|deny|denied/.test(err.errMsg || '')
        wx.showModal({ title: denied ? '需要相册权限' : '图片未保存',
          content: denied ? '可在设置中允许保存到相册，再回来重试。战报会保留在此页面。' : '你可以留在此页面稍后重试。',
          confirmText: denied ? '去设置' : '知道了', showCancel: denied,
          success: r => { if (denied && r.confirm) wx.openSetting({}) } })
      }, complete: () => this.setData({ saving: false }) })
  }
}))
