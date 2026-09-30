const { DEFAULT_RULES } = require('../../utils/game-rules')
Page({
  data: {
    gameType: 'hanchan',   // tonpuu=东风, hanchan=半庄
    startPoints: 25000,
    returnPoints: 30000,
    uma: '10-20',          // 顺位马
    windLabels: ['東', '南', '西', '北'],
    players: ['東家', '南家', '西家', '北家'],
    rules: { ...DEFAULT_RULES },
    ruleOptions: [
      { key: 'multipleRon', label: '多家荣和', note: '允许两家或三家同时荣和，各家分别加本场；供托归放铳者下家方向最近的和了者。' },
      { key: 'bankruptcy', label: '飞人终局', note: '任一玩家点数小于 0 时结束；恰好 0 点继续。' },
      { key: 'extension', label: '延长战', note: '规定场结束时无人达到返还点，东风延长至南场、半庄至西场；延长场有人达标即结束，最多延长一个场。' },
      { key: 'dealerFinish', label: '末局庄家首位止', note: '末局庄家和牌或听牌连庄，且首位达到返还点时自动结束；同点按起始座位顺序排名。' }
    ],
    umaOptions: [
      { label: '5-10', value: '5-10' },
      { label: '10-20', value: '10-20' },
      { label: '10-30', value: '10-30' },
      { label: '20-30', value: '20-30' }
    ]
  },

  toggleRule(e) {
    const key = e.currentTarget.dataset.key
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_RULES, key)) return
    const rules = { ...this.data.rules, [key]: e.detail.value }
    this.setData({ rules })
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
    players[idx] = e.detail.value
    this.setData({ players })
  },

  startGame() {
    const config = {
      gameType: this.data.gameType,
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
})
