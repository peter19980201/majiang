const Reports = require('../../utils/battle-report')
Component({
  properties: { report: { type:Object, value:null } },
  data: { rankLabels:['一位','二位','三位','四位'] },
  methods: {
    copy() { if (this.data.report) wx.setClipboardData({data:Reports.text(this.data.report)}) },
    preview() { if (this.data.report) wx.navigateTo({url:'/pages/battle-report/battle-report?id=' + encodeURIComponent(this.data.report.id)}) }
  }
})
