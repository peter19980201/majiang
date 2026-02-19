Page({
  data: {
    gameType: 'hanchan',   // tonpuu=东风, hanchan=半庄
    startPoints: 25000,
    returnPoints: 30000,
    uma: '10-20',          // 顺位马
    windLabels: ['東', '南', '西', '北'],
    players: ['東家', '南家', '西家', '北家'],
    umaOptions: [
      { label: '5-10', value: '5-10' },
      { label: '10-20', value: '10-20' },
      { label: '10-30', value: '10-30' },
      { label: '20-30', value: '20-30' }
    ]
  },

  setGameType(e) {
    this.setData({ gameType: e.currentTarget.dataset.val })
  },

  setUma(e) {
    this.setData({ uma: e.currentTarget.dataset.val })
  },

  changeStartPoints(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    const pts = Math.max(10000, Math.min(50000, this.data.startPoints + delta))
    this.setData({ startPoints: pts })
  },

  changeReturnPoints(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    const pts = Math.max(10000, Math.min(50000, this.data.returnPoints + delta))
    this.setData({ returnPoints: pts })
  },

  onPlayerInput(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    const players = this.data.players.slice()
    players[idx] = e.detail.value || ['東家', '南家', '西家', '北家'][idx]
    this.setData({ players })
  },

  startGame() {
    const config = {
      gameType: this.data.gameType,
      startPoints: this.data.startPoints,
      returnPoints: this.data.returnPoints,
      uma: this.data.uma,
      players: this.data.players
    }
    wx.redirectTo({
      url: `/pages/game/board?config=${encodeURIComponent(JSON.stringify(config))}`
    })
  }
})
