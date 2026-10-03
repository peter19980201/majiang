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
    settlementReport: null,
    settlementCanCorrect: false
  },

  onLoad(options) { if (options.expandId) this.setData({ expandedId: options.expandId }) },

  onShow() {
    const currentGame = wx.getStorageSync('currentGame') || null
    const list = GameStorage.history()
    this.setData({ currentGame, historyList: list.map(game => ({
      id: game.id, date: game.date, config: game.config, result: game.result,
      abandoned: game.abandoned, ruleSummary: summary(game.config || {}),
      rounds: (game.rounds || []).map((round, index, rounds) => RoundView.card(round, index === rounds.length - 1)),
      canCorrect: Boolean(game.gameState && game.rounds && game.rounds.length &&
        game.rounds[game.rounds.length - 1].before)
    })) })
    if (this.data.settlementVisible && this.data.settlementReport) {
      const selected = list.find(r => String(r.id) === String(this.data.settlementReport.id))
      if (selected) this.setData({ settlementReport: Reports.build(selected),
        settlementCanCorrect: Boolean(selected.gameState && selected.rounds && selected.rounds.length && selected.rounds[selected.rounds.length - 1].before) })
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

  correctLastRound(e) {
    if (this.data.currentGame) {
      wx.showToast({ title: '请先结束当前对局再修改历史', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/game/board?historyId=${encodeURIComponent(e.currentTarget.dataset.id)}` })
  },

  viewSettlement(e) {
    const id = e.currentTarget.dataset.id
    const record = GameStorage.history().find(r => String(r.id) === String(id))
    if (!record) return
    this.setData({ settlementReport:Reports.build(record), settlementVisible:true,
      settlementCanCorrect:Boolean(record.gameState && record.rounds && record.rounds.length && record.rounds[record.rounds.length - 1].before) })
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
