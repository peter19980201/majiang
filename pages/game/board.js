const WIND_NAMES = ['東', '南', '西', '北']

Page({
  data: {
    // 配置
    config: null,
    players: [],    // [{name, points, wind}]
    // 局况
    roundWind: 0,   // 0=東, 1=南
    roundWindName: '東',
    roundNum: 1,    // 1-4
    honba: 0,
    riichiSticks: 0,
    dealerIdx: 0,   // 庄家玩家索引(固定座位)
    windLabels: ['東', '南', '西', '北'],
    // 状态
    gameOver: false,
    roundHistory: [],
    // 弹窗
    showActionModal: false,
    showRonModal: false,
    showTsumoModal: false,
    showDrawModal: false,
    showResultModal: false,
    // 和了录入
    selectedWinner: -1,
    selectedLoser: -1,
    inputPoints: '',
    showManualInput: false,
    // 本局立直
    roundRiichi: [false, false, false, false],
    // 流局
    drawTenpai: [false, false, false, false],
    // 结算
    finalResult: []
  },

  onLoad(options) {
    // 恢复进行中的对局
    if (options.resume) {
      const saved = wx.getStorageSync('currentGame')
      if (saved && saved.gameState) {
        this.setData(saved.gameState)
        return
      }
    }
    // 新建对局
    if (options.config) {
      const config = JSON.parse(decodeURIComponent(options.config))
      const players = config.players.map((name, i) => ({
        name,
        points: config.startPoints,
        seatWind: i  // 固定座位: 0=東, 1=南, 2=西, 3=北
      }))
      this.setData({ config, players, dealerIdx: 0 })
      this._autoSave()
    }
  },

  getRoundLabel() {
    return `${WIND_NAMES[this.data.roundWind]}${this.data.roundNum}局 ${this.data.honba}本场`
  },

  // === 操作弹窗 ===
  showActions() {
    if (this.data.gameOver) return
    this.setData({ showActionModal: true })
  },

  stopBubble() {},

  closeActions() {
    this.setData({ showActionModal: false })
  },

  earlySettlement() {
    wx.showModal({
      title: '提前结算',
      content: '确定要以当前点棒状态结算本局吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ showActionModal: false, gameOver: true })
          this.doSettlement()
        }
      }
    })
  },

  // === 立直切换 ===
  toggleRoundRiichi(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    const r = this.data.roundRiichi.slice()
    r[idx] = !r[idx]
    this.setData({ roundRiichi: r })
  },

  // 处理本局立直: 扣除1000点/人, 返回新增立直棒数
  _applyRiichi(players) {
    const riichi = this.data.roundRiichi
    let newSticks = 0
    for (let i = 0; i < 4; i++) {
      if (riichi[i]) {
        players[i].points -= 1000
        newSticks++
      }
    }
    return newSticks
  },

  // === 荣和 ===
  startRon() {
    this.setData({ showActionModal: false })
    setTimeout(() => {
      this.setData({
        showRonModal: true,
        selectedWinner: -1,
        selectedLoser: -1,
        inputPoints: '',
        showManualInput: false,
        roundRiichi: [false, false, false, false]
      })
    }, 150)
  },

  selectRonWinner(e) {
    this.setData({ selectedWinner: parseInt(e.currentTarget.dataset.idx) })
  },

  selectRonLoser(e) {
    this.setData({ selectedLoser: parseInt(e.currentTarget.dataset.idx) })
  },

  onPointsInput(e) {
    this.setData({ inputPoints: e.detail.value })
  },

  confirmRon() {
    const { selectedWinner, selectedLoser, inputPoints } = this.data
    const pts = parseInt(inputPoints)
    if (selectedWinner < 0 || selectedLoser < 0 || !pts || pts <= 0) {
      wx.showToast({ title: '请完善信息', icon: 'none' }); return
    }
    if (selectedWinner === selectedLoser) {
      wx.showToast({ title: '和了者和放铳者不能相同', icon: 'none' }); return
    }

    const honbaBonus = this.data.honba * 300
    const totalPts = pts + honbaBonus

    const players = this.data.players.slice().map(p => ({ ...p }))
    const newSticks = this._applyRiichi(players)
    const allSticks = this.data.riichiSticks + newSticks

    players[selectedWinner].points += totalPts + allSticks * 1000
    players[selectedLoser].points -= totalPts

    const record = {
      type: 'ron',
      round: this.getRoundLabel(),
      winner: players[selectedWinner].name,
      loser: players[selectedLoser].name,
      points: pts,
      honbaBonus,
      riichiCollected: allSticks
    }

    this.setData({ players, showRonModal: false, riichiSticks: 0 })
    this.addRecord(record)
    this.advanceRound(selectedWinner === this.data.dealerIdx)
    this._autoSave()
  },

  closeRon() {
    this.setData({ showRonModal: false })
  },

  toggleManualInput() {
    this.setData({ showManualInput: !this.data.showManualInput })
  },

  // === 计算器导航 ===
  goToCalcRon() {
    const { selectedWinner, selectedLoser } = this.data
    if (selectedWinner < 0 || selectedLoser < 0) {
      wx.showToast({ title: '请选择和了者和放铳者', icon: 'none' }); return
    }
    if (selectedWinner === selectedLoser) {
      wx.showToast({ title: '和了者和放铳者不能相同', icon: 'none' }); return
    }
    this._navigateToCalc('ron')
  },

  goToCalcTsumo() {
    const { selectedWinner } = this.data
    if (selectedWinner < 0) {
      wx.showToast({ title: '请选择和了者', icon: 'none' }); return
    }
    this._navigateToCalc('tsumo')
  },

  _navigateToCalc(agariType) {
    const { roundWind, dealerIdx, honba, selectedWinner, roundRiichi, riichiSticks } = this.data
    const bakaze = 27 + roundWind
    const jikaze = 27 + ((selectedWinner - dealerIdx + 4) % 4)
    const winnerRiichi = roundRiichi[selectedWinner] ? 1 : 0
    // 计算总供托数 (已有 + 本局新增)
    let newSticks = 0
    for (let i = 0; i < 4; i++) if (roundRiichi[i]) newSticks++
    const totalSticks = riichiSticks + newSticks

    const that = this
    this.setData({ showRonModal: false, showTsumoModal: false })

    wx.navigateTo({
      url: `/pages/calculator/calculator?mode=board&agariType=${agariType}&bakaze=${bakaze}&jikaze=${jikaze}&honba=${honba}&riichi=${winnerRiichi}&sticks=${totalSticks}`,
      events: {
        calcResult(data) {
          if (agariType === 'ron') {
            that._processCalcRon(data)
          } else {
            that._processCalcTsumo(data)
          }
        }
      }
    })
  },

  _processCalcRon(calcResult) {
    const { selectedWinner, selectedLoser } = this.data
    const players = this.data.players.slice().map(p => ({ ...p }))

    const newSticks = this._applyRiichi(players)
    const allSticks = this.data.riichiSticks + newSticks

    // payment.total 已含本场加算
    players[selectedWinner].points += calcResult.payment.total + allSticks * 1000
    players[selectedLoser].points -= calcResult.payment.total

    const record = {
      type: 'ron',
      round: this.getRoundLabel(),
      winner: players[selectedWinner].name,
      loser: players[selectedLoser].name,
      points: calcResult.payment.total,
      han: calcResult.han,
      fu: calcResult.fu,
      level: calcResult.level,
      yakuSummary: calcResult.yaku ? calcResult.yaku.map(y => y.name).join(' ') : '',
      riichiCollected: allSticks
    }

    this.setData({ players, riichiSticks: 0 })
    this.addRecord(record)
    this.advanceRound(selectedWinner === this.data.dealerIdx)
    this._autoSave()
  },

  _processCalcTsumo(calcResult) {
    const { selectedWinner } = this.data
    const players = this.data.players.slice().map(p => ({ ...p }))
    const payment = calcResult.payment

    const newSticks = this._applyRiichi(players)
    const allSticks = this.data.riichiSticks + newSticks

    // 使用计算器返回的分账明细 (已含本场)
    if (payment.type === 'tsumo_oya') {
      for (let i = 0; i < 4; i++) {
        if (i !== selectedWinner) {
          players[i].points -= payment.koPayment
          players[selectedWinner].points += payment.koPayment
        }
      }
    } else {
      for (let i = 0; i < 4; i++) {
        if (i === selectedWinner) continue
        const pay = (i === this.data.dealerIdx) ? payment.oyaPayment : payment.koPayment
        players[i].points -= pay
        players[selectedWinner].points += pay
      }
    }

    players[selectedWinner].points += allSticks * 1000

    const record = {
      type: 'tsumo',
      round: this.getRoundLabel(),
      winner: players[selectedWinner].name,
      points: payment.total,
      desc: payment.description,
      han: calcResult.han,
      fu: calcResult.fu,
      level: calcResult.level,
      yakuSummary: calcResult.yaku ? calcResult.yaku.map(y => y.name).join(' ') : '',
      riichiCollected: allSticks
    }

    this.setData({ players, riichiSticks: 0 })
    this.addRecord(record)
    this.advanceRound(selectedWinner === this.data.dealerIdx)
    this._autoSave()
  },

  // === 自摸 ===
  startTsumo() {
    this.setData({ showActionModal: false })
    setTimeout(() => {
      this.setData({
        showTsumoModal: true,
        selectedWinner: -1,
        inputPoints: '',
        showManualInput: false,
        roundRiichi: [false, false, false, false]
      })
    }, 150)
  },

  selectTsumoWinner(e) {
    this.setData({ selectedWinner: parseInt(e.currentTarget.dataset.idx) })
  },

  confirmTsumo() {
    const { selectedWinner, inputPoints } = this.data
    const pts = parseInt(inputPoints)
    if (selectedWinner < 0 || !pts || pts <= 0) {
      wx.showToast({ title: '请完善信息', icon: 'none' }); return
    }

    const isOya = selectedWinner === this.data.dealerIdx
    const honbaBonus = this.data.honba * 100
    const players = this.data.players.slice().map(p => ({ ...p }))

    const newSticks = this._applyRiichi(players)
    const allSticks = this.data.riichiSticks + newSticks

    // 自摸分账: 输入的是总点数，需要拆分
    let desc = ''
    if (isOya) {
      const each = Math.ceil(pts / 3 / 100) * 100
      for (let i = 0; i < 4; i++) {
        if (i !== selectedWinner) {
          const pay = each + honbaBonus
          players[i].points -= pay
          players[selectedWinner].points += pay
        }
      }
      desc = `子家各付${each + honbaBonus}点`
    } else {
      const oyaPay = Math.ceil(pts / 2 / 100) * 100
      const koPay = Math.ceil(pts / 4 / 100) * 100
      for (let i = 0; i < 4; i++) {
        if (i === selectedWinner) continue
        const pay = (i === this.data.dealerIdx ? oyaPay : koPay) + honbaBonus
        players[i].points -= pay
        players[selectedWinner].points += pay
      }
      desc = `庄家${oyaPay + honbaBonus}点/子家${koPay + honbaBonus}点`
    }

    players[selectedWinner].points += allSticks * 1000

    const record = {
      type: 'tsumo',
      round: this.getRoundLabel(),
      winner: players[selectedWinner].name,
      points: pts,
      desc,
      riichiCollected: allSticks
    }

    this.setData({ players, showTsumoModal: false, riichiSticks: 0 })
    this.addRecord(record)
    this.advanceRound(selectedWinner === this.data.dealerIdx)
    this._autoSave()
  },

  closeTsumo() {
    this.setData({ showTsumoModal: false })
  },

  // === 流局 ===
  startDraw() {
    this.setData({ showActionModal: false })
    setTimeout(() => {
      this.setData({
        showDrawModal: true,
        drawTenpai: [false, false, false, false],
        roundRiichi: [false, false, false, false]
      })
    }, 150)
  },

  toggleTenpai(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    const t = this.data.drawTenpai.slice()
    t[idx] = !t[idx]
    this.setData({ drawTenpai: t })
  },

  confirmDraw() {
    const tenpai = this.data.drawTenpai
    const tenpaiCount = tenpai.filter(Boolean).length
    const players = this.data.players.slice().map(p => ({ ...p }))

    // 处理本局立直 (流局时立直棒累积到供托，不被收走)
    const newSticks = this._applyRiichi(players)

    // 不听罚符: 3000点由不听者支付给听牌者
    if (tenpaiCount > 0 && tenpaiCount < 4) {
      const payTotal = 3000
      const payEach = Math.floor(payTotal / (4 - tenpaiCount))
      const receiveEach = Math.floor(payTotal / tenpaiCount)
      for (let i = 0; i < 4; i++) {
        if (tenpai[i]) {
          players[i].points += receiveEach
        } else {
          players[i].points -= payEach
        }
      }
    }

    const tenpaiNames = players.filter((_, i) => tenpai[i]).map(p => p.name)
    const record = {
      type: 'draw',
      round: this.getRoundLabel(),
      tenpai: tenpaiNames.length > 0 ? tenpaiNames.join('、') + '听牌' : '全员不听'
    }

    // 流局: 庄家听牌=连庄, 否则轮庄
    const dealerTenpai = tenpai[this.data.dealerIdx]
    // 流局立直棒累积到供托
    this.setData({ players, showDrawModal: false, riichiSticks: this.data.riichiSticks + newSticks })
    this.addRecord(record)

    // 流局本场数+1
    const honba = this.data.honba + 1
    this.setData({ honba })
    this.advanceRound(dealerTenpai, true)
    this._autoSave()
  },

  closeDraw() {
    this.setData({ showDrawModal: false })
  },

  // === 局进行 ===
  addRecord(record) {
    const history = this.data.roundHistory.concat([record])
    this.setData({ roundHistory: history })
  },

  advanceRound(dealerWin, isDraw) {
    if (dealerWin) {
      // 连庄
      if (!isDraw) {
        this.setData({ honba: this.data.honba + 1 })
      }
      return
    }

    // 轮庄
    if (!isDraw) {
      this.setData({ honba: 0 })
    }

    let { roundWind, roundNum, dealerIdx } = this.data
    dealerIdx = (dealerIdx + 1) % 4
    roundNum++
    if (roundNum > 4) {
      roundNum = 1
      roundWind++
    }

    // 终局判断
    const maxWind = this.data.config.gameType === 'tonpuu' ? 1 : 2
    if (roundWind >= maxWind) {
      this.setData({ dealerIdx, roundWind, roundWindName: WIND_NAMES[roundWind], roundNum, gameOver: true })
      this.doSettlement()
      return
    }

    this.setData({ dealerIdx, roundWind, roundWindName: WIND_NAMES[roundWind], roundNum })
  },

  // === 结算 ===
  doSettlement() {
    // 已结算过则只显示弹窗，不重复计算和保存
    if (this.data.finalResult.length > 0) {
      this.setData({ showResultModal: true })
      return
    }

    const { config, players } = this.data
    const uma = config.uma.split('-').map(Number)
    const umaValues = [uma[1], uma[0], -uma[0], -uma[1]] // 1位+, 2位+, 3位-, 4位-

    const sorted = players.map((p, i) => ({ ...p, idx: i }))
      .sort((a, b) => b.points - a.points)

    const result = sorted.map((p, rank) => {
      const rawPt = (p.points - config.returnPoints) / 1000
      const umaVal = umaValues[rank]
      return {
        rank: rank + 1,
        name: p.name,
        points: p.points,
        rawPt,
        uma: umaVal,
        finalPt: rawPt + umaVal
      }
    })

    this.setData({ finalResult: result, showResultModal: true })
    this.saveHistory(result)
  },

  saveHistory(result) {
    const record = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      config: this.data.config,
      result,
      rounds: this.data.roundHistory
    }
    const history = wx.getStorageSync('gameHistory') || []
    history.unshift(record)
    if (history.length > 50) history.length = 50
    wx.setStorageSync('gameHistory', history)
    // 结算后清除进行中存档
    wx.removeStorageSync('currentGame')
  },

  // 自动保存当前对局进度
  _autoSave() {
    if (this.data.gameOver) return
    wx.setStorageSync('currentGame', {
      date: new Date().toLocaleDateString(),
      gameState: {
        config: this.data.config,
        players: this.data.players,
        roundWind: this.data.roundWind,
        roundWindName: this.data.roundWindName,
        roundNum: this.data.roundNum,
        honba: this.data.honba,
        riichiSticks: this.data.riichiSticks,
        dealerIdx: this.data.dealerIdx,
        gameOver: this.data.gameOver,
        roundHistory: this.data.roundHistory
      }
    })
  },

  closeResult() {
    this.setData({ showResultModal: false })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/game/history' })
  }
})
