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
    expandedId: -1
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
    wx.navigateTo({ url: `/pages/settlement/settlement?id=${encodeURIComponent(e.currentTarget.dataset.id)}` })
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
