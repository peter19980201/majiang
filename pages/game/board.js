const WIND_NAMES = ['東', '南', '西', '北']
const Records = require('../../utils/game-records')
const RoundView = require('../../utils/round-view')

const boardDefinition = {
  data: {
    // 配置
    config: null,
    gameId: '',
    gameDate: '',
    editingLastRound: false,
    entryHonba: 0,
    entryRiichiSticks: 0,
    entryDealerIdx: 0,
    entryRoundLabel: '',
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
    endedEarly: false,
    roundHistory: [],
    historyCards: [],
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
    inputKoPayment: '',
    inputOyaPayment: '',
    showManualInput: false,
    // 本局立直
    roundRiichi: [false, false, false, false],
    // 流局
    drawTenpai: [false, false, false, false],
    drawPreview: [],
    drawTenpaiCount: 0,
    // 结算
    finalResult: []
  },

  onLoad(options) {
    if (options.historyId) {
      const history = wx.getStorageSync('gameHistory') || []
      const saved = history.find(record => String(record.id) === options.historyId)
      const current = wx.getStorageSync('currentGame')
      if (current && current.gameState && current.gameState.gameId !== options.historyId) {
        wx.showToast({ title: '请先结束当前对局再修改历史', icon: 'none' })
        wx.navigateBack()
        return
      }
      if (saved && saved.gameState) {
        this.setData({ ...saved.gameState, gameId: String(saved.id), gameDate: saved.date })
        this._refreshHistoryCards()
      } else {
        wx.showToast({ title: '此记录暂不支持纠错', icon: 'none' })
        wx.navigateBack()
      }
      return
    }
    // 恢复进行中的对局
    if (options.resume) {
      const saved = wx.getStorageSync('currentGame')
      if (saved && saved.gameState) {
        this.setData(saved.gameState)
        this.setData({ gameId: saved.gameState.gameId || Records.newGameId(), gameDate: saved.date })
        this._autoSave()
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
      this.setData({ config, players, dealerIdx: 0, gameId: Records.newGameId(), gameDate: new Date().toLocaleDateString() })
      this._autoSave()
    }
  },

  getRoundLabel() {
    return `${WIND_NAMES[this.data.roundWind]}${this.data.roundNum}局 ${this.data.honba}本场`
  },

  _entryState() {
    return this._editingRecord ? this._editingRecord.before : this.data
  },

  _prepareEntry() {
    const state = this._entryState()
    this.setData({ entryHonba: state.honba, entryRiichiSticks: state.riichiSticks,
      entryDealerIdx: state.dealerIdx,
      entryRoundLabel: `${WIND_NAMES[state.roundWind]}${state.roundNum}局 ${state.honba}本场` })
  },

  // All result paths calculate on a draft; only a valid result replaces the saved state.
  _commitRound(method, source, calcResult) {
    if (this.data.gameOver && !this._editingRecord) return
    if (!this._canWriteGame()) return
    const original = this.data
    const history = this._editingRecord ? original.roundHistory.slice(0, -1) : original.roundHistory.slice()
    const before = Records.snapshot(this._entryState())
    // Page methods are bound to the native live instance. Inherit raw methods
    // so every nested score/rotation call stays on this isolated draft.
    const draft = Object.create(boardDefinition)
    draft.data = Records.clone({ ...original, ...before, roundHistory: history,
      gameOver: false, finalResult: [] })
    if (calcResult && calcResult.calculatorInput) {
      draft.data.roundRiichi[draft.data.selectedWinner] = Boolean(
        calcResult.calculatorInput.riichi || calcResult.calculatorInput.doubleRiichi)
    }
    draft.setData = values => Object.assign(draft.data, values)
    draft._autoSave = () => {}
    draft.doSettlement = () => {}
    draft[method](calcResult)
    if (draft.data.roundHistory.length !== history.length + 1) return
    // An explicitly ended game stays ended after correction; undo can reopen it.
    if (this._editingRecord && original.gameOver &&
        (original.endedEarly || !this._editingRecord.after.gameOver)) {
      draft.data.gameOver = true
      draft.data.endedEarly = true
    }
    const record = draft.data.roundHistory[draft.data.roundHistory.length - 1]
    record.version = 2
    record.id = this._editingRecord ? this._editingRecord.id : Records.newGameId()
    record.before = before
    record.after = Records.snapshot(draft.data)
    record.input = { ...Records.input(original), roundRiichi: draft.data.roundRiichi.slice(), source,
      calculatorInput: calcResult && calcResult.calculatorInput ? Records.clone(calcResult.calculatorInput) : null }
    if (calcResult) {
      const payment = calcResult.payment
      if (record.type === 'ron') record.input.inputPoints = String(payment.total - before.honba * 300)
      else {
        record.input.inputKoPayment = String(payment.koPayment - before.honba * 100)
        record.input.inputOyaPayment = payment.oyaPayment === undefined ? '' : String(payment.oyaPayment - before.honba * 100)
      }
    }
    this._editingRecord = null
    this.setData({ ...Records.snapshot(draft.data), roundHistory: draft.data.roundHistory,
      editingLastRound: false, showRonModal: false, showTsumoModal: false, showDrawModal: false,
      showResultModal: false, roundRiichi: [false, false, false, false] })
    if (this.data.gameOver) this.doSettlement()
    else {
      this._removeSavedSettlement()
      this._autoSave()
    }
  },

  _removeSavedSettlement() {
    const history = wx.getStorageSync('gameHistory') || []
    const updated = history.filter(record => String(record.id) !== this.data.gameId)
    if (updated.length !== history.length) wx.setStorageSync('gameHistory', updated)
  },

  _canWriteGame() {
    const saved = wx.getStorageSync('currentGame')
    if (saved && saved.gameState && saved.gameState.gameId !== this.data.gameId) {
      wx.showToast({ title: '另一场对局进行中，请先结束', icon: 'none' })
      return false
    }
    return true
  },

  _refreshHistoryCards() {
    this.setData({ historyCards: this.data.roundHistory.map((record, index, records) => ({
      ...RoundView.describe(record), latest: index === records.length - 1
    })) })
  },

  openRoundDetail(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index !== this.data.roundHistory.length - 1) return
    const record = this.data.roundHistory[index]
    if (!record) return
    const isCurrent = () => this.data.roundHistory[this.data.roundHistory.length - 1] === record
    wx.navigateTo({
      url: '/pages/game/round-detail',
      events: {
        editRound: () => { if (isCurrent()) this.editLastRound() },
        deleteRound: () => { if (isCurrent()) this._restoreLastRound(record) }
      },
      success: res => res.eventChannel.emit('roundDetail', RoundView.describe(record))
    })
  },

  _restoreLastRound(record) {
    if (this._editingRecord || !record || !record.before || !record.input) return
    if (this.data.roundHistory[this.data.roundHistory.length - 1] !== record) return
    if (!this._canWriteGame()) return
    this.setData({ ...Records.clone(record.before), roundHistory: this.data.roundHistory.slice(0, -1),
      finalResult: [], gameOver: false, showResultModal: false,
      roundRiichi: [false, false, false, false] })
    this._removeSavedSettlement()
    this._autoSave()
  },

  undoLastRound() {
    if (this._editingRecord) return
    const record = this.data.roundHistory[this.data.roundHistory.length - 1]
    if (!record) return
    if (!record.before || !record.input) {
      wx.showToast({ title: '这条旧记录暂不支持删除', icon: 'none' })
      return
    }
    wx.showModal({ title: '删除本局记录', content: `删除${record.round}，恢复录入前的点棒和局况？`,
      success: res => { if (res.confirm) this._restoreLastRound(record) }
    })
  },

  editLastRound() {
    const record = this.data.roundHistory[this.data.roundHistory.length - 1]
    if (!record) return
    if (!record.before || !record.input) {
      wx.showToast({ title: '这条旧记录暂不支持修改', icon: 'none' })
      return
    }
    this._editingRecord = Records.clone(record)
    this.setData({ ...Records.clone(record.input), editingLastRound: true,
      showResultModal: false, showManualInput: record.input.source === 'manual',
      showRonModal: record.type === 'ron', showTsumoModal: record.type === 'tsumo',
      showDrawModal: record.type === 'draw' })
    this._prepareEntry()
    if (record.type === 'draw') this.updateDrawPreview()
  },

  changeEditType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ showRonModal: type === 'ron', showTsumoModal: type === 'tsumo',
      showDrawModal: type === 'draw' })
    if (type === 'draw') this.updateDrawPreview()
  },

  _cancelEntry() {
    this._editingRecord = null
    this.setData({ editingLastRound: false, showRonModal: false, showTsumoModal: false,
      showDrawModal: false, roundRiichi: [false, false, false, false] })
  },

  onShow() {
    if (this._returningFromCalculator) {
      this._returningFromCalculator = false
      if (this._editingRecord) {
        const type = this._calculatorType
        this.setData({ showRonModal: type === 'ron', showTsumoModal: type === 'tsumo' })
      }
    }
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
          if (!this._canWriteGame()) return
          this.setData({ showActionModal: false, gameOver: true, endedEarly: true })
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
    if (this.data.showDrawModal) this.updateDrawPreview()
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
    this._prepareEntry()
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
    this._commitRound('_applyManualRon', 'manual')
  },

  _applyManualRon() {
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
    this._cancelEntry()
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
    const { roundWind, dealerIdx, honba, riichiSticks } = this._entryState()
    const { selectedWinner, roundRiichi } = this.data
    const bakaze = 27 + roundWind
    const jikaze = 27 + ((selectedWinner - dealerIdx + 4) % 4)
    const winnerRiichi = roundRiichi[selectedWinner] ? 1 : 0
    // 计算总供托数 (已有 + 本局新增)
    let newSticks = 0
    for (let i = 0; i < 4; i++) if (roundRiichi[i]) newSticks++
    const totalSticks = riichiSticks + newSticks

    const that = this
    const calculatorInput = this._editingRecord && this._editingRecord.input.calculatorInput
    this._returningFromCalculator = true
    this._calculatorType = agariType
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
      },
      success(res) {
        if (calculatorInput) res.eventChannel.emit('restoreInput', Records.clone(calculatorInput))
      }
    })
  },

  _processCalcRon(calcResult) {
    this._commitRound('_applyCalcRon', 'calculator', calcResult)
  },

  _applyCalcRon(calcResult) {
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
    this._commitRound('_applyCalcTsumo', 'calculator', calcResult)
  },

  _applyCalcTsumo(calcResult) {
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
    this._prepareEntry()
    this.setData({ showActionModal: false })
    setTimeout(() => {
      this.setData({
        showTsumoModal: true,
        selectedWinner: -1,
        inputKoPayment: '',
        inputOyaPayment: '',
        showManualInput: false,
        roundRiichi: [false, false, false, false]
      })
    }, 150)
  },

  selectTsumoWinner(e) {
    const selectedWinner = parseInt(e.currentTarget.dataset.idx)
    if (selectedWinner !== this.data.selectedWinner) {
      this.setData({ selectedWinner, inputKoPayment: '', inputOyaPayment: '' })
    }
  },

  onKoPaymentInput(e) {
    this.setData({ inputKoPayment: e.detail.value })
  },

  onOyaPaymentInput(e) {
    this.setData({ inputOyaPayment: e.detail.value })
  },

  confirmTsumo() {
    this._commitRound('_applyManualTsumo', 'manual')
  },

  _applyManualTsumo() {
    const { selectedWinner, inputKoPayment, inputOyaPayment } = this.data
    if (!Number.isInteger(selectedWinner) || selectedWinner < 0 || selectedWinner >= this.data.players.length) {
      wx.showToast({ title: '请选择和了者', icon: 'none' }); return
    }

    const isOya = selectedWinner === this.data.dealerIdx
    const koPayment = Number(inputKoPayment)
    const oyaPayment = isOya ? koPayment : Number(inputOyaPayment)
    const validPayment = value => Number.isSafeInteger(value) && value > 0 && value % 100 === 0
    if (!validPayment(koPayment) || !validPayment(oyaPayment)) {
      wx.showToast({ title: '支付额须为正数且是100的倍数', icon: 'none' }); return
    }
    const honbaBonus = this.data.honba * 100
    const players = this.data.players.slice().map(p => ({ ...p }))

    const newSticks = this._applyRiichi(players)
    const allSticks = this.data.riichiSticks + newSticks

    // 直接使用各家支付额，本场另加，供托单独领取。
    let pts = 0
    let desc = ''
    if (isOya) {
      const each = koPayment
      for (let i = 0; i < 4; i++) {
        if (i !== selectedWinner) {
          const pay = each + honbaBonus
          players[i].points -= pay
          players[selectedWinner].points += pay
          pts += pay
        }
      }
      desc = `子家各付${each + honbaBonus}点`
    } else {
      const oyaPay = oyaPayment
      const koPay = koPayment
      for (let i = 0; i < 4; i++) {
        if (i === selectedWinner) continue
        const pay = (i === this.data.dealerIdx ? oyaPay : koPay) + honbaBonus
        players[i].points -= pay
        players[selectedWinner].points += pay
        pts += pay
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
    this._cancelEntry()
  },

  // === 流局 ===
  startDraw() {
    this._prepareEntry()
    this.setData({ showActionModal: false })
    setTimeout(() => {
      this.setData({
        showDrawModal: true,
        drawTenpai: [false, false, false, false],
        roundRiichi: [false, false, false, false]
      })
      this.updateDrawPreview()
    }, 150)
  },

  toggleTenpai(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    const t = this.data.drawTenpai.slice()
    t[idx] = !t[idx]
    this.setData({ drawTenpai: t })
    this.updateDrawPreview()
  },

  updateDrawPreview() {
    const { drawTenpai, roundRiichi } = this.data
    const { players } = this._entryState()
    const count = drawTenpai.filter(Boolean).length
    const drawPreview = players.map((p, i) => {
      const transfer = count > 0 && count < 4 ? (drawTenpai[i] ? 3000 / count : -3000 / (4 - count)) : 0
      return { name: p.name, delta: transfer - (roundRiichi[i] ? 1000 : 0) }
    })
    this.setData({ drawPreview, drawTenpaiCount: count })
  },

  confirmDraw() {
    this._commitRound('_applyDraw', 'manual')
  },

  _applyDraw() {
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
    this._cancelEntry()
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
    this._refreshHistoryCards()
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
    const last = this.data.roundHistory[this.data.roundHistory.length - 1]
    if (last && last.after && last.after.gameOver) last.after = Records.snapshot(this.data)
    this.saveHistory(result)
  },

  saveHistory(result) {
    const record = {
      id: this.data.gameId,
      date: this.data.gameDate,
      config: this.data.config,
      result,
      rounds: this.data.roundHistory,
      gameState: { ...Records.snapshot(this.data), gameId: this.data.gameId,
        gameDate: this.data.gameDate, roundHistory: this.data.roundHistory }
    }
    const history = (wx.getStorageSync('gameHistory') || []).filter(h => String(h.id) !== this.data.gameId)
    history.unshift(record)
    if (history.length > 50) history.length = 50
    wx.setStorageSync('gameHistory', history)
    // 结算后清除进行中存档
    wx.removeStorageSync('currentGame')
  },

  // 自动保存当前对局进度
  _autoSave() {
    this._refreshHistoryCards()
    if (this.data.gameOver) return
    wx.setStorageSync('currentGame', {
      date: this.data.gameDate,
      gameState: {
        gameId: this.data.gameId,
        gameDate: this.data.gameDate,
        config: this.data.config,
        players: this.data.players,
        roundWind: this.data.roundWind,
        roundWindName: this.data.roundWindName,
        roundNum: this.data.roundNum,
        honba: this.data.honba,
        riichiSticks: this.data.riichiSticks,
        dealerIdx: this.data.dealerIdx,
        gameOver: this.data.gameOver,
        endedEarly: this.data.endedEarly,
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
}

Page(boardDefinition)
