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
  endGame() {
    if (this._ending) return
    const saved = GameStorage.current()
    if (!saved || !saved.gameState || saved.gameState.gameOver) {
      this.onShow()
      return
    }
    this._ending = true
    wx.showModal({
      title:'提前结束对局',
      content:'确定提前结束当前对局吗？将按当前点数结算并保存到战绩，结束后无法继续此对局。',
      confirmText:'确认结束', cancelText:'继续对局',
      success: res => {
        if (!res.confirm) return
        try {
          const latest = GameStorage.current()
          if (!latest || !latest.gameState || latest.gameState.gameOver ||
              latest.gameState.gameId !== saved.gameState.gameId) {
            this.onShow()
            wx.showToast({ title:'对局已变化，请重新确认', icon:'none' })
            return
          }
          GameStorage.finishSavedGame(latest)
          this.onShow()
          wx.showToast({ title:'已结算并保存到战绩', icon:'none' })
        } catch (error) {
          wx.showToast({ title:'结束失败，请重试', icon:'none' })
        }
      },
      complete: () => { this._ending = false }
    })
  },
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
