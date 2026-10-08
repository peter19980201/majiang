const quick = require('../../pages/quick-score/definition')
Component({
  data: { tableOya:false, tableType:'ron', rows:[], limits:[] },
  lifetimes: { attached() { this.refreshTable() } },
  methods: { selectTable:quick.selectTable, refreshTable:quick.refreshTable }
})
