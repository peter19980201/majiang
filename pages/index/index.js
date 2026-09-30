const { settle } = require('../../utils/game-settlement')
Page({
  data: { currentGame: null },
  onShow() {
    const saved = wx.getStorageSync('currentGame')
    this.setData({ currentGame: saved && saved.gameState && !saved.gameState.gameOver ? saved : null })
  },
  resumeGame() { wx.navigateTo({ url: '/pages/game/board?resume=1' }) },
  newGame() {
    const saved = wx.getStorageSync('currentGame')
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
    const currentGame = wx.getStorageSync('currentGame')
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
    const state = saved.gameState
    const config = state.config
    const result = settle(config, state.players)
    const record = {
      id: state.gameId || Date.now(), date: saved.date, config, result,
      rounds: state.roundHistory, abandoned: true,
      gameState: { ...state, gameOver: true, endedEarly: true, finalResult: result }
    }
    const history = (wx.getStorageSync('gameHistory') || []).filter(h => String(h.id) !== String(record.id))
    history.unshift(record)
    wx.setStorageSync('gameHistory', history)
    wx.removeStorageSync('currentGame')
  },
  goReference() {
    wx.navigateTo({ url: '/pages/reference/reference' })
  },
  goHistory() {
    wx.navigateTo({ url: '/pages/game/history' })
  }
})
