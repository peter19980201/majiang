const quick = require('../../pages/quick-score/definition')
Component({
  data: { playerCount:4, tableOya:false, tableType:'ron', rows:[], limits:[] },
  lifetimes: { attached() { this.refreshTable() } },
  methods: { setPlayerCount(e) { this.setData({ playerCount: Number(e.currentTarget.dataset.count) === 3 ? 3 : 4 }); this.refreshTable() }, selectTable:quick.selectTable, refreshTable:quick.refreshTable }
})
