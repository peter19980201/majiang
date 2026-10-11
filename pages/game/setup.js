const { withShare } = require('../../utils/share')
const { DEFAULT_RULES } = require('../../utils/game-rules')
Page(withShare({
  data: {
    gameType: 'free', playerCount: 4, sanmaUma: 15, sanmaUmaOptions: [10, 15, 20, 30],
    startPoints: 25000,
    returnPoints: 30000,
    uma: '10-20',          // 顺位马
    windLabels: ['東', '南', '西', '北'],
    players: ['東家', '南家', '西家', '北家'],
    rules: { ...DEFAULT_RULES },
    umaOptions: [
      { label: '5-10', value: '5-10' },
      { label: '10-20', value: '10-20' },
      { label: '10-30', value: '10-30' },
      { label: '20-30', value: '20-30' }
    ]
  },

  onLoad(options = {}) {
    const playerCount = Number(options.playerCount) === 3 ? 3 : 4
    this.setData({ playerCount, players: ['東家', '南家', '西家', '北家'].slice(0, playerCount),
      startPoints: playerCount === 3 ? 35000 : 25000,
      returnPoints: playerCount === 3 ? 40000 : 30000 })
  },
  setSanmaUma(e) { this.setData({ sanmaUma: Number(e.currentTarget.dataset.val) }) },
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
    players[idx] = e.detail.value
    this.setData({ players })
  },

  startGame() {
    const config = {
      sanmaRuleVersion: this.data.playerCount === 3 ? 1 : undefined, gameType: this.data.gameType, playerCount: this.data.playerCount, sanmaUma: this.data.sanmaUma,
      startPoints: this.data.startPoints,
      returnPoints: this.data.returnPoints,
      uma: this.data.uma,
      rules: { ...this.data.rules },
      players: this.data.players.map((name, index) =>
        name.trim() ? name : this.data.windLabels[index] + '家')
    }
    wx.redirectTo({
      url: `/pages/game/board?config=${encodeURIComponent(JSON.stringify(config))}`
    })
  }
}))
