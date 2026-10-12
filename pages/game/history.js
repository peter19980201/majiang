const Confirmation = require('../../utils/confirmation')
const { withShare } = require('../../utils/share')
const GameStorage = require('../../utils/game-storage')
const Reports = require('../../utils/battle-report')
Page(withShare({
  data: {
    rankLabels: ['一位', '二位', '三位', '四位'],
    historyList: [],
    historyFilter: 'all',
    searchQuery: '',
    hasSearch: false,
    totalCount: 0,
    favoriteCount: 0,
    settlementVisible: false,
    settlementReport: null
  },

  onShow() {
    const list = GameStorage.history()
    this._records = list
    this.refreshList()
    if (this.data.settlementVisible && this.data.settlementReport) {
      const selected = list.find(r => String(r.id) === String(this.data.settlementReport.id))
      if (selected) this.setData({ settlementReport: Reports.build(selected) })
      else this.closeSettlement()
    }
  },

  refreshList() {
    const names = this.data.searchQuery.trim().split(/\s+/).filter(Boolean)
    const list = (this._records || []).filter(game => {
      const players = game.result && game.result.length ? game.result : (game.gameState && game.gameState.players) || []
      return names.every(name => players.some(player => String(player.name || '').includes(name)))
    })
    const visible = this.data.historyFilter === 'favorites' ? list.filter(game => game.favorite) : list
    this.setData({ hasSearch: names.length > 0, totalCount: list.length, favoriteCount: list.filter(game => game.favorite).length,
      historyList: visible.map(game => ({
      id: game.id, date: game.date, config: game.config, result: game.result,
      abandoned: game.abandoned, favorite: Boolean(game.favorite)
    })) })
  },

  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value })
    this.refreshList()
  },

  changeFilter(e) {
    const filter = e.currentTarget.dataset.filter
    if (!['all', 'favorites'].includes(filter) || filter === this.data.historyFilter) return
    this.setData({ historyFilter: filter })
    this.refreshList()
  },

  toggleFavorite(e) {
    try {
      const favorite = GameStorage.toggleFavorite(e.currentTarget.dataset.id)
      if (favorite === null) return
      this.onShow()
    } catch (error) {
      wx.showToast({ title: '收藏保存失败，请重试', icon: 'none' })
    }
  },

  onExpandTap(e) {
    this.viewSettlement(e)
  },

  closeSettlement() { this.setData({ settlementVisible:false }) },
  stopBubble() {},

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id
    Confirmation.show(this, {
      title: '确认删除',
      content: (this._records || []).some(record => String(record.id) === String(id) && record.favorite)
        ? '这场对局已收藏，删除后无法恢复' : '删除后无法恢复',
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
  }
}))
