Page({
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
    const uma = config.uma.split('-').map(Number)
    const umaValues = [uma[1], uma[0], -uma[0], -uma[1]]
    const sorted = state.players.map((p, i) => ({ ...p, idx: i }))
      .sort((a, b) => b.points - a.points)
    const result = sorted.map((p, rank) => {
      const rawPt = (p.points - config.returnPoints) / 1000
      const umaVal = umaValues[rank]
      return { rank: rank + 1, name: p.name, points: p.points, rawPt, uma: umaVal, finalPt: rawPt + umaVal }
    })
    const record = {
      id: Date.now(), date: saved.date, config, result,
      rounds: state.roundHistory, abandoned: true
    }
    const history = wx.getStorageSync('gameHistory') || []
    history.unshift(record)
    if (history.length > 50) history.length = 50
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
