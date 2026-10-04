const { withShare } = require('../../utils/share')
const GameStorage = require('../../utils/game-storage')
const Reports = require('../../utils/battle-report')
Page(withShare({
  data: {
    currentGame: null,
    rankLabels: ['一位', '二位', '三位', '四位'],
    historyList: [],
    settlementVisible: false,
    settlementReport: null
  },

  onShow() {
    const currentGame = GameStorage.current() || null
    const list = GameStorage.history()
    this.setData({ currentGame, historyList: list.map(game => ({
      id: game.id, date: game.date, config: game.config, result: game.result,
      abandoned: game.abandoned
    })) })
    if (this.data.settlementVisible && this.data.settlementReport) {
      const selected = list.find(r => String(r.id) === String(this.data.settlementReport.id))
      if (selected) this.setData({ settlementReport: Reports.build(selected) })
      else this.closeSettlement()
    }
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
          GameStorage.finishSavedGame(this.data.currentGame)
          this.onShow()
        }
      }
    })
  },

  onExpandTap(e) {
    this.viewSettlement(e)
  },

  closeSettlement() { this.setData({ settlementVisible:false }) },
  stopBubble() {},

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          GameStorage.removeHistory(id)
          this.onShow()
        }
      }
    })
  },

  viewSettlement(e) {
    const id = e.currentTarget.dataset.id
    const record = GameStorage.history().find(r => String(r.id) === String(id))
    if (!record) return
    this.setData({ settlementReport:Reports.build(record), settlementVisible:true })
  },

  clearAll() {
    wx.showModal({
      title: '清空全部',
      content: '确定要删除所有历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          GameStorage.clearHistory()
          this.onShow()
        }
      }
    })
  }
}))
