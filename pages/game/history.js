const { withShare } = require('../../utils/share')
const GameStorage = require('../../utils/game-storage')
const Reports = require('../../utils/battle-report')
const RoundView = require('../../utils/round-view')
const { summary } = require('../../utils/game-rules')
Page(withShare({
  data: {
    currentGame: null,
    windLabels: ['東', '南', '西', '北'],
    rankLabels: ['一位', '二位', '三位', '四位'],
    historyList: [],
    expandedId: -1,
    settlementVisible: false,
    settlementReport: null
  },

  onLoad(options) { if (options.expandId) this.setData({ expandedId: options.expandId }) },

  onShow() {
    const currentGame = wx.getStorageSync('currentGame') || null
    const list = GameStorage.history()
    this.setData({ currentGame, historyList: list.map(game => ({
      id: game.id, date: game.date, config: game.config, result: game.result,
      abandoned: game.abandoned, ruleSummary: summary(game.config || {}),
      rounds: (game.rounds || []).map((round, index, rounds) => RoundView.card(round, index === rounds.length - 1))
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

  correctLastRound() {
    wx.showToast({ title: '已结算的对局仅供查看', icon: 'none' })
  },

  viewSettlement(e) {
    const id = e.currentTarget.dataset.id
    const record = GameStorage.history().find(r => String(r.id) === String(id))
    if (!record) return
    this.setData({ settlementReport:Reports.build(record), settlementVisible:true })
  },

  copyBattleReport(e) {
    const record = GameStorage.history().find(r => String(r.id) === String(e.currentTarget.dataset.id))
    if (record) wx.setClipboardData({ data: Reports.text(Reports.build(record)),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) })
  },

  previewBattleReport(e) {
    wx.navigateTo({ url: `/pages/battle-report/battle-report?id=${encodeURIComponent(e.currentTarget.dataset.id)}` })
  },

  clearAll() {
    wx.showModal({
      title: '清空全部',
      content: '确定要删除所有历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('gameHistory', [])
          this.onShow()
        }
      }
    })
  }
}))
