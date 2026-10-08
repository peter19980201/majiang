const { withShare } = require('../../utils/share')
const GameStorage = require('../../utils/game-storage')
const { openNewGame } = require('../../utils/main-navigation')
Page(withShare({
  data: { currentGame: null },
  onShow() {
    const saved = GameStorage.current()
    this.setData({ currentGame: saved && saved.gameState && !saved.gameState.gameOver ? saved : null })
  },
  resumeGame() { wx.navigateTo({ url: '/pages/game/board?resume=1' }) },
  newGame() { openNewGame(() => this.setData({ currentGame:null })) },
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
    wx.switchTab({ url: '/pages/reference/reference' })
  },
  goHistory() {
    wx.switchTab({ url: '/pages/game/history' })
  }
}, { timeline: true }))
