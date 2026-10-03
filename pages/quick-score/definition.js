const { withShare } = require('../../utils/share')
const Quick = require('../../utils/quick-score')

module.exports = withShare({
  data: {
    tab: 'calc', boardMode: false, kind: 'hanfu', han: 3, fu: 40, yakumanTimes: 1,
    isOya: false, agariType: 'ron', honba: 0, boardSticks: 0,
    hanOptions: Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: i === 12 ? '13番+' : `${i + 1}番` })),
    fuOptions: Quick.FU, yakumanOptions: [1, 2, 3, 4, 5, 6],
    ruleNote: Quick.RULE_NOTE, result: null, error: '', summary: '',
    tableOya: false, tableType: 'ron', rows: [], limits: [], busy: false
  },
  onLoad(options = {}) {
    if (options.tab === 'table') this.setData({ tab: 'table' })
    if (options.mode === 'board') {
      this.setData({ boardMode: true, isOya: Number(options.jikaze) === 27,
        agariType: options.agariType, honba: Number(options.honba), boardSticks: Number(options.sticks) || 0 })
      this.getOpenerEventChannel().on('restoreQuickInput', input => {
        this.setData({ kind: input.kind, han: input.han, fu: input.fu, yakumanTimes: input.yakumanTimes })
        this.refresh()
      })
    }
    this.refresh()
    if (this.data.tab === 'table') this.refreshTable()
  },
  select(e) {
    const { key, value } = e.currentTarget.dataset
    if (!['kind', 'han', 'fu', 'yakumanTimes', 'isOya', 'agariType'].includes(key)) return
    if (this.data.boardMode && ['isOya', 'agariType'].includes(key)) return
    const parsed = ['han', 'fu', 'yakumanTimes'].includes(key) ? Number(value) : key === 'isOya' ? String(value) === 'true' : value
    this.setData({ [key]: parsed })
    this.refresh()
  },
  changeHonba(e) {
    if (this.data.boardMode) return
    this.setData({ honba: Math.max(0, Math.min(99, this.data.honba + Number(e.currentTarget.dataset.delta))) })
    this.refresh()
  },
  refresh() {
    const result = Quick.calculate(this.data)
    this.setData({ result: result.error ? null : result, error: result.error || '', summary: result.error ? '' : Quick.label(result) })
  },
  selectTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    if (tab === 'table' && !this.data.rows.length) this.refreshTable()
  },
  selectTable(e) {
    const { key, value } = e.currentTarget.dataset
    if (!['tableOya', 'tableType'].includes(key)) return
    this.setData({ [key]: key === 'tableOya' ? String(value) === 'true' : value })
    this.refreshTable()
  },
  refreshTable() {
    const { tableOya: isOya, tableType: agariType } = this.data
    const limits = [5, 6, 8, 11, 13].map(han => {
      const r = Quick.calculate({ kind: 'hanfu', han, fu: 0, isOya, agariType, honba: 0 })
      return { name: { 5: '5番', 6: '6–7番', 8: '8–10番', 11: '11–12番', 13: '13番以上' }[han],
        level: r.level, payment: r.payment.description }
    })
    this.setData({ rows: Quick.table(isOya, agariType), limits })
  },
  confirm() {
    if (!this.data.boardMode || this.data.busy) return
    const result = Quick.calculate(this.data)
    if (result.error) return
    this.setData({ busy: true })
    this.getOpenerEventChannel().emit('calcResult', result)
    if (!this._embedded) wx.navigateBack({ fail: () => this.setData({ error: '已发送记分结果，请返回对局查看。勿重复记分。' }) })
  },
  goBack() { if (this._embedded) this.triggerEvent('dismiss'); else wx.navigateBack() }
})
