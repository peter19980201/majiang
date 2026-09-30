Page({
  data: {
    currentGame: null,
    windLabels: ['東', '南', '西', '北'],
    historyList: [],
    expandedId: -1
  },

  onShow() {
    const currentGame = wx.getStorageSync('currentGame') || null
    const list = wx.getStorageSync('gameHistory') || []
    this.setData({ currentGame, historyList: list })
  },

  resumeGame() {
    wx.redirectTo({ url: '/pages/game/board?resume=1' })
  },

  abandonGame() {
    wx.showModal({
      title: '结束对局',
      content: '将以当前点棒状态结算并存入历史记录',
      success: (res) => {
        if (res.confirm) {
          const saved = this.data.currentGame
          const state = saved.gameState
          const config = state.config

          // 结算
          const uma = config.uma.split('-').map(Number)
          const umaValues = [uma[1], uma[0], -uma[0], -uma[1]]
          const sorted = state.players.map((p, i) => ({ ...p, idx: i }))
            .sort((a, b) => b.points - a.points)
          const result = sorted.map((p, rank) => {
            const rawPt = (p.points - config.returnPoints) / 1000
            const umaVal = umaValues[rank]
            return {
              rank: rank + 1,
              name: p.name,
              points: p.points,
              rawPt,
              uma: umaVal,
              finalPt: rawPt + umaVal
            }
          })

          // 存入历史
          const record = {
            id: state.gameId || Date.now(),
            date: saved.date,
            config,
            result,
            rounds: state.roundHistory,
            abandoned: true,
            gameState: { ...state, gameOver: true, endedEarly: true, finalResult: result }
          }
          const history = (wx.getStorageSync('gameHistory') || []).filter(h => String(h.id) !== String(record.id))
          history.unshift(record)
          if (history.length > 50) history.length = 50
          wx.setStorageSync('gameHistory', history)

          wx.removeStorageSync('currentGame')
          this.setData({ currentGame: null, historyList: history })
        }
      }
    })
  },

  onExpandTap(e) {
    const record = this.data.historyList.find(h => String(h.id) === String(e.currentTarget.dataset.id))
    if (!record) return
    const id = record.id
    this.setData({ expandedId: this.data.expandedId === id ? -1 : id })
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          const list = this.data.historyList.filter(h => String(h.id) !== String(id))
          wx.setStorageSync('gameHistory', list)
          this.setData({ historyList: list })
        }
      }
    })
  },

  correctLastRound(e) {
    if (this.data.currentGame) {
      wx.showToast({ title: '请先结束当前对局再修改历史', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/game/board?historyId=${encodeURIComponent(e.currentTarget.dataset.id)}` })
  },

  clearAll() {
    wx.showModal({
      title: '清空全部',
      content: '确定要删除所有历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('gameHistory', [])
          this.setData({ historyList: [] })
        }
      }
    })
  }
})
