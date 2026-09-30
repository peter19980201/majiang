Page({
  data: { record: null, busy: false },

  onLoad() {
    this.channel = this.getOpenerEventChannel()
    this.channel.on('roundDetail', record => this.setData({ record }))
  },

  _returnWithAction(action) {
    if (this.data.busy) return
    this.setData({ busy: true })
    wx.navigateBack({
      success: () => this.channel.emit(action),
      fail: () => this.setData({ busy: false })
    })
  },

  editRecord() {
    if (!this.data.record || !this.data.record.canChange) return
    this._returnWithAction('editRound')
  },

  deleteRecord() {
    const record = this.data.record
    if (!record || !record.canChange || this.data.busy) return
    wx.showModal({
      title: '删除本局记录',
      content: `删除${record.round}后，点棒、庄家、本场及供托将恢复到本局录入前。`,
      confirmText: '删除',
      confirmColor: '#a34e40',
      success: res => { if (res.confirm) this._returnWithAction('deleteRound') }
    })
  }
})
