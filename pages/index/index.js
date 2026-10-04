const { withShare } = require('../../utils/share')
const GameStorage = require('../../utils/game-storage')
Page(withShare({
  data: { currentGame: null },
  onShow() {
    const saved = GameStorage.current()
    this.setData({ currentGame: saved && saved.gameState && !saved.gameState.gameOver ? saved : null })
  },
  resumeGame() { wx.navigateTo({ url: '/pages/game/board?resume=1' }) },
  newGame() {
    const saved = GameStorage.current()
    if (!saved || !saved.gameState) {
      wx.navigateTo({ url: '/pages/game/setup' })
      return
    }
    wx.showModal({
      title: '新建对局', content: '当前对局将结算并保存到历史记录，是否继续？',
      confirmText: '新建对局',
      success: (res) => {
        if (res.confirm) {
          this._settleAndSave(saved)
          this.setData({ currentGame: null })
          wx.navigateTo({ url: '/pages/game/setup' })
        }
      }
    })
  },
  goCalculator() {
    wx.navigateTo({ url: '/pages/calculator/calculator' })
  },
  goGameSetup() {
    const currentGame = GameStorage.current()
    if (currentGame && currentGame.gameState) {
      wx.showModal({
        title: '存在进行中的对局',
        content: '新建将结算当前对局并存入历史',
        confirmText: '继续',
        cancelText: '新建',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/game/board?resume=1' })
          } else {
            this._settleAndSave(currentGame)
            wx.navigateTo({ url: '/pages/game/setup' })
          }
        }
      })
      return
    }
    wx.navigateTo({ url: '/pages/game/setup' })
  },
  // 将进行中的对局结算存入历史
  _settleAndSave(saved) {
    GameStorage.finishSavedGame(saved)
  },
  goReference() {
    wx.navigateTo({ url: '/pages/reference/reference' })
  },
  goHistory() {
    wx.navigateTo({ url: '/pages/game/history' })
  }
}, { timeline: true }))
