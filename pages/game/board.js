const { withShare } = require('../../utils/share')
const WIND_NAMES = ['東', '南', '西', '北']
const Records = require('../../utils/game-records')
const RoundView = require('../../utils/round-view')
const GameRules = require('../../utils/game-rules')
const { settle } = require('../../utils/game-settlement')
const GameStorage = require('../../utils/game-storage')

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
    endReason: '',
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
    multiRonMode: false,
    ronEntries: [],
    ronChoices: [],
    showManualInput: false,
    // 本局立直
    roundRiichi: [false, false, false, false],
    // 流局
    drawTenpai: [false, false, false, false],
    drawPreview: [],
    drawTenpaiCount: 0,
    drawType: 'exhaustive',
    abortReason: '九种九牌',
    abortReasons: GameRules.ABORT_REASONS,
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
        playerId: config.playerIds ? config.playerIds[i] : null,
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
      entryRoundLabel: `${WIND_NAMES[state.roundWind]}${state.roundNum}局 ${state.honba}本场`,
      abortReasons: GameRules.ABORT_REASONS })
  },

  // Winner count determines the form; no separate single/multiple mode switch.
  _refreshRonChoices() {
    if (!this.data.multiRonMode && !this.data.ronEntries.length && this.data.selectedWinner >= 0) {
      const idx = this.data.selectedWinner
      const old = this._editingRecord
      const quickInput = old && old.input.quickInput
      const calcResult = old && old.input.source !== 'manual' ? {
        source: old.input.source, quickInput, calculatorInput: old.input.calculatorInput,
        han: old.han, fu: old.fu, level: old.level, yaku: old.yaku || [],
        payment: { total: Number(this.data.inputPoints) + this._entryState().honba * 300 }
      } : null
      this.setData({ ronEntries: [{ idx, name: this.data.players[idx].name,
        points: this.data.inputPoints, calcResult, calculatorInput: old && old.input.calculatorInput }] })
    }
    this.setData({ ronChoices: this.data.players.map((p, idx) => ({ name: p.name, idx,
      active: this.data.ronEntries.some(entry => entry.idx === idx), disabled: idx === this.data.selectedLoser })) })
  },

  _setRonEntries(ronEntries) {
    const single = ronEntries.length === 1 ? ronEntries[0] : null
    this.setData({ ronEntries, multiRonMode: ronEntries.length > 1,
      selectedWinner: single ? single.idx : -1,
      inputPoints: single ? single.points || '' : '',
      showManualInput: Boolean(single && single.points) })
    this._refreshRonChoices()
  },

  selectMultiRonWinner(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    if (!Number.isInteger(idx) || !this.data.players[idx] || idx === this.data.selectedLoser) return
    const selected = this.data.ronEntries.some(entry => entry.idx === idx)
    if (!selected && this.data.ronEntries.length >= 3) {
      wx.showToast({ title: '最多选择三位和了者', icon: 'none' }); return
    }
    const ronEntries = selected ? this.data.ronEntries.filter(entry => entry.idx !== idx) :
      this.data.ronEntries.concat([{ idx, name: this.data.players[idx].name, points: '', calculatorInput: null }])
    this._setRonEntries(ronEntries)
  },

  onMultiRonPoints(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const ronEntries = this.data.ronEntries.map(entry => entry.idx === idx ?
      { ...entry, points: e.detail.value, calcResult: null } : entry)
    this.setData({ ronEntries })
  },

  openMultiRonPoints(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ ronEntries: this.data.ronEntries.map(entry => ({ ...entry,
      editingPoints: entry.idx === idx,
      draftPoints: entry.idx === idx ? entry.points || '' : entry.draftPoints })) })
  },

  onMultiRonDraft(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ ronEntries: this.data.ronEntries.map(entry => entry.idx === idx ?
      { ...entry, draftPoints: e.detail.value } : entry) })
  },

  saveMultiRonPoints(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const entry = this.data.ronEntries.find(item => item.idx === idx)
    const points = entry && Number(entry.draftPoints)
    if (!Number.isSafeInteger(points) || points <= 0 || points % 100 !== 0) {
      wx.showToast({ title: '请输入正整数点数（100的倍数）', icon: 'none' }); return
    }
    this.setData({ ronEntries: this.data.ronEntries.map(item => item.idx === idx ?
      { ...item, points: String(points), calcResult: null, calculatorInput: null,
        editingPoints: false, draftPoints: '' } : item) })
  },

  goToMultiCalc(e, mode) {
    if (this.data.selectedLoser < 0) {
      wx.showToast({ title: '请先选择放铳者', icon: 'none' }); return
    }
    this.setData({ selectedWinner: Number(e.currentTarget.dataset.idx) })
    this._navigateToCalc('ron', mode)
  },

  _applyMultiRon() {
    const { ronEntries, selectedLoser, players: current } = this.data
    const validSeat = idx => Number.isInteger(idx) && idx >= 0 && idx < current.length
    if (!validSeat(selectedLoser) ||
        ronEntries.length < 2 || ronEntries.length > 3 ||
        new Set(ronEntries.map(entry => entry.idx)).size !== ronEntries.length ||
        ronEntries.some(entry => !validSeat(entry.idx) || entry.idx === selectedLoser)) {
      wx.showToast({ title: '请选择放铳者及两至三位和了者', icon: 'none' }); return
    }
    if (ronEntries.some(entry => !Number.isSafeInteger(Number(entry.points)) ||
        Number(entry.points) <= 0 || Number(entry.points) % 100 !== 0)) {
      wx.showToast({ title: '请填写各家点数（100的倍数）', icon: 'none' }); return
    }
    const players = current.map(p => ({ ...p }))
    const sticks = this.data.riichiSticks + this._applyRiichi(players)
    const winners = ronEntries.map(entry => ({ idx: entry.idx, name: players[entry.idx].name,
      points: Number(entry.points), payment: Number(entry.points) + this.data.honba * 300,
      source: entry.calcResult && entry.calcResult.source === 'hanfu' ? 'hanfu' : entry.calcResult ? 'calculator' : 'manual',
      han: entry.calcResult ? entry.calcResult.han : null, fu: entry.calcResult ? entry.calcResult.fu : null,
      level: entry.calcResult ? entry.calcResult.level : '',
      yaku: entry.calcResult ? RoundView.sortedYaku(entry.calcResult) : [] }))
    winners.forEach(winner => {
      players[winner.idx].points += winner.payment
      players[selectedLoser].points -= winner.payment
    })
    const nearest = winners.slice().sort((a, b) =>
      ((a.idx - selectedLoser + 4) % 4) - ((b.idx - selectedLoser + 4) % 4))[0]
    players[nearest.idx].points += sticks * 1000
    this.setData({ players, riichiSticks: 0 })
    this.addRecord({ type: 'ron', round: this.getRoundLabel(), winner: winners.map(p => p.name).join('、'),
      winners, loser: players[selectedLoser].name, points: winners.reduce((sum, p) => sum + p.payment, 0),
      basePayment: winners.reduce((sum, p) => sum + p.points, 0),
      honbaBonus: this.data.honba * 300 * winners.length,
      riichiCollected: sticks, riichiRecipient: nearest.name,
      desc: winners.map(p => `${p.name} ${p.payment}点`).join(' / ') + `；供托归${nearest.name}` })
    this.advanceRound(winners.some(p => p.idx === this.data.dealerIdx))
    this._autoSave()
  },

  selectDrawType(e) {
    const drawType = e.currentTarget.dataset.type
    if (!['exhaustive', 'abortive'].includes(drawType)) return
    this.setData({ drawType })
    this.updateDrawPreview()
  },

  selectAbortReason(e) {
    const abortReason = e.currentTarget.dataset.reason
    this.setData({ abortReason })
    if (abortReason === '四家立直') this.setData({ roundRiichi: [true, true, true, true] })
    this.updateDrawPreview()
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
    draft.data = { ...Records.clone(before), ...Records.input(original),
      roundHistory: history, gameOver: false, finalResult: [] }
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
    const hasQuickInput = (calcResult && calcResult.source === 'hanfu') ||
      (record.winners && original.ronEntries.some(entry => entry.calcResult && entry.calcResult.source === 'hanfu'))
    record.version = hasQuickInput ? 4 : 3
    record.id = this._editingRecord ? this._editingRecord.id : Records.newGameId()
    record.before = before
    record.after = Records.snapshot(draft.data)
    record.input = { ...Records.input(original), roundRiichi: draft.data.roundRiichi.slice(),
      drawType: draft.data.drawType, abortReason: draft.data.abortReason, source,
      quickInput: calcResult && calcResult.quickInput ? Records.clone(calcResult.quickInput) : null,
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
    GameStorage.removeHistory(this.data.gameId)
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
    this.setData({ historyCards: this.data.roundHistory.map((record, index, records) =>
      RoundView.card(record, index === records.length - 1)) })
  },

  openRoundDetail(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0 || index >= this.data.roundHistory.length) return
    const record = this.data.roundHistory[index]
    if (!record) return
    const isCurrent = () => this.data.roundHistory[this.data.roundHistory.length - 1] === record
    wx.navigateTo({
      url: '/pages/game/round-detail',
      events: {
        editRound: () => { if (isCurrent()) this.editLastRound() },
        deleteRound: () => { if (isCurrent()) this._restoreLastRound(record) }
      },
      success: res => res.eventChannel.emit('roundDetail', RoundView.describe(record, index === this.data.roundHistory.length - 1))
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
    this.setData({ multiRonMode: false, ronEntries: [], drawType: 'exhaustive', abortReason: '九种九牌',
      ...Records.clone(record.input), editingLastRound: true,
      showResultModal: false, showManualInput: record.input.source === 'manual',
      showRonModal: record.type === 'ron', showTsumoModal: record.type === 'tsumo',
      showDrawModal: record.type === 'draw' })
    this._prepareEntry()
    this._refreshRonChoices()
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
      if (!this._calculatorResultReceived || this._editingRecord || this.data.multiRonMode) {
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
        multiRonMode: false,
        ronEntries: [],
        showManualInput: false,
        roundRiichi: [false, false, false, false]
      })
      this._refreshRonChoices()
    }, 150)
  },

  selectRonWinner(e) {
    this.selectMultiRonWinner(e)
  },

  selectRonLoser(e) {
    const selectedLoser = parseInt(e.currentTarget.dataset.idx)
    this.setData({ selectedLoser })
    this._setRonEntries(this.data.ronEntries.filter(entry => entry.idx !== selectedLoser))
  },

  onPointsInput(e) {
    this.setData({ inputPoints: e.detail.value, ronEntries: this.data.ronEntries.map(entry =>
      entry.idx === this.data.selectedWinner ? { ...entry, points: e.detail.value, calcResult: null } : entry) })
  },

  confirmRon() {
    if (this.data.multiRonMode && this.data.ronEntries.some(entry => entry.editingPoints)) {
      wx.showToast({ title: '请先保存正在输入的点数', icon: 'none' }); return
    }
    const single = !this.data.multiRonMode && this.data.ronEntries.find(entry => entry.idx === this.data.selectedWinner)
    if (single && single.calcResult) {
      this._processCalcRon(single.calcResult)
      return
    }
    this._commitRound(this.data.multiRonMode ? '_applyMultiRon' : '_applyManualRon', 'manual')
  },

  _applyManualRon() {
    const { selectedWinner, selectedLoser, inputPoints } = this.data
    const pts = Number(inputPoints)
    const validSeat = idx => Number.isInteger(idx) && idx >= 0 && idx < this.data.players.length
    if (!validSeat(selectedWinner) || !validSeat(selectedLoser)) {
      wx.showToast({ title: '请完善信息', icon: 'none' }); return
    }
    if (!Number.isSafeInteger(pts) || pts <= 0 || pts % 100 !== 0) {
      wx.showToast({ title: '点数须为正数且是100的倍数', icon: 'none' }); return
    }
    if (selectedWinner === selectedLoser) {
      wx.showToast({ title: '和了者和放铳者不能相同', icon: 'none' }); return
    }

    this._applyWin({ type: 'ron', total: pts + this.data.honba * 300 })
  },

  closeRon() {
    this._cancelEntry()
  },

  toggleManualInput() {
    this.setData({ showManualInput: !this.data.showManualInput })
  },

  // === 计算器导航 ===
  goToQuickRon() { this.goToCalcRon('quick') },

  goToQuickTsumo() { this.goToCalcTsumo('quick') },

  goToMultiQuick(e) { this.goToMultiCalc(e, 'quick') },

  goToCalcRon(mode) {
    const { selectedWinner, selectedLoser } = this.data
    if (selectedWinner < 0 || selectedLoser < 0) {
      wx.showToast({ title: '请选择和了者和放铳者', icon: 'none' }); return
    }
    if (selectedWinner === selectedLoser) {
      wx.showToast({ title: '和了者和放铳者不能相同', icon: 'none' }); return
    }
    this._navigateToCalc('ron', mode)
  },

  goToCalcTsumo(mode) {
    const { selectedWinner } = this.data
    if (selectedWinner < 0) {
      wx.showToast({ title: '请选择和了者', icon: 'none' }); return
    }
    this._navigateToCalc('tsumo', mode)
  },

  _navigateToCalc(agariType, mode) {
    const quick = mode === 'quick'
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
    const multi = agariType === 'ron' && this.data.multiRonMode
    const multiEntry = multi && this.data.ronEntries.find(entry => entry.idx === selectedWinner)
    const singleEntry = !multi && agariType === 'ron' && this.data.ronEntries.find(entry => entry.idx === selectedWinner)
    const calculatorInput = multi ? multiEntry && multiEntry.calculatorInput : singleEntry ? singleEntry.calculatorInput :
      this._editingRecord && this._editingRecord.input.calculatorInput
    const quickInput = multi ? multiEntry && multiEntry.calcResult && multiEntry.calcResult.quickInput : singleEntry ? singleEntry.calcResult && singleEntry.calcResult.quickInput :
      this._editingRecord && this._editingRecord.input.quickInput
    this._calculatorResultReceived = false
    this._returningFromCalculator = true
    this._calculatorType = agariType
    this.setData({ showRonModal: false, showTsumoModal: false })

    wx.navigateTo({
      url: `/pages/${quick ? 'quick-score/quick-score' : 'calculator/calculator'}?mode=board&agariType=${agariType}&bakaze=${bakaze}&jikaze=${jikaze}&honba=${honba}&riichi=${winnerRiichi}&sticks=${totalSticks}`,
      events: {
        calcResult(data) {
          that._calculatorResultReceived = true
          if (multi) {
            const ronEntries = that.data.ronEntries.map(entry => entry.idx === selectedWinner ?
              { ...entry, points: String(data.payment.total - honba * 300),
                calculatorInput: data.calculatorInput || null, calcResult: data, editingPoints: false, draftPoints: '' } : entry)
            const riichi = that.data.roundRiichi.slice()
            if (data.calculatorInput) riichi[selectedWinner] = Boolean(data.calculatorInput.riichi || data.calculatorInput.doubleRiichi)
            that.setData({ ronEntries, roundRiichi: riichi, showRonModal: true })
            return
          }
          if (agariType === 'ron') {
            that._processCalcRon(data)
          } else {
            that._processCalcTsumo(data)
          }
        }
      },
      success(res) {
        if (quick && quickInput) res.eventChannel.emit('restoreQuickInput', Records.clone(quickInput))
        if (!quick && calculatorInput) res.eventChannel.emit('restoreInput', Records.clone(calculatorInput))
      },
      fail() {
        that._returningFromCalculator = false
        that.setData({ showRonModal: agariType === 'ron', showTsumoModal: agariType === 'tsumo' })
      }
    })
  },

  _processCalcRon(calcResult) {
    this._commitRound('_applyCalcRon', calcResult.source === 'hanfu' ? 'hanfu' : 'calculator', calcResult)
  },

  _applyCalcRon(calcResult) {
    this._applyWin({ ...calcResult.payment, type: 'ron' }, calcResult)
  },

  _processCalcTsumo(calcResult) {
    this._commitRound('_applyCalcTsumo', calcResult.source === 'hanfu' ? 'hanfu' : 'calculator', calcResult)
  },

  _applyCalcTsumo(calcResult) {
    this._applyWin({ ...calcResult.payment, type: 'tsumo' }, calcResult)
  },

  // Both input sources supply payments that already include honba.
  _applyWin(payment, calcResult) {
    const { selectedWinner, selectedLoser, dealerIdx, honba } = this.data
    const validSeat = idx => Number.isInteger(idx) && idx >= 0 && idx < this.data.players.length
    const validPayment = value => Number.isSafeInteger(value) && value > 0 && value % 100 === 0
    const isTsumo = payment.type === 'tsumo'
    if (!validSeat(selectedWinner) || (!isTsumo &&
        (!validSeat(selectedLoser) || selectedWinner === selectedLoser))) {
      wx.showToast({ title: '请选择有效的和了者及放铳者', icon: 'none' }); return
    }
    const amounts = this.data.players.map((_, idx) => {
      if (idx === selectedWinner) return 0
      if (isTsumo) return idx === dealerIdx ? payment.oyaPayment : payment.koPayment
      return idx === selectedLoser ? payment.total : 0
    })
    if (!amounts.filter((_, idx) => idx !== selectedWinner && (isTsumo || idx === selectedLoser)).every(validPayment)) {
      wx.showToast({ title: '支付额须为正数且是100的倍数', icon: 'none' }); return
    }
    const total = amounts.reduce((sum, amount) => sum + amount, 0)
    if (total !== payment.total) {
      wx.showToast({ title: '支付额与总点数不一致', icon: 'none' }); return
    }
    const players = this.data.players.map(p => ({ ...p }))
    const allSticks = this.data.riichiSticks + this._applyRiichi(players)
    amounts.forEach((amount, idx) => { players[idx].points -= amount })
    players[selectedWinner].points += total + allSticks * 1000
    const record = {
      type: payment.type, round: this.getRoundLabel(), winner: players[selectedWinner].name,
      points: total, basePayment: total - honba * 300, honbaBonus: honba * 300,
      riichiCollected: allSticks
    }
    if (isTsumo) {
      record.desc = selectedWinner === dealerIdx ? `子家各付${payment.koPayment}点` :
        `庄家${payment.oyaPayment}点/子家${payment.koPayment}点`
    } else record.loser = players[selectedLoser].name
    if (calcResult) {
      Object.assign(record, { han: calcResult.han, fu: calcResult.fu, level: calcResult.level,
        yaku: Records.clone(calcResult.yaku || []),
        yakuSummary: (calcResult.yaku || []).map(y => y.name).join(' ') })
    }
    this.setData({ players, riichiSticks: 0 })
    this.addRecord(record)
    this.advanceRound(selectedWinner === dealerIdx)
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
        multiRonMode: false,
        ronEntries: [],
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
    const bonus = this.data.honba * 100
    this._applyWin({ type: 'tsumo', koPayment: koPayment + bonus,
      oyaPayment: oyaPayment + bonus,
      total: (isOya ? koPayment * 3 : koPayment * 2 + oyaPayment) + bonus * 3 })
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
        drawType: 'exhaustive',
        abortReason: '九种九牌',
        multiRonMode: false,
        ronEntries: [],
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
    const { drawTenpai, roundRiichi, drawType } = this.data
    const { players } = this._entryState()
    const count = drawTenpai.filter(Boolean).length
    const drawPreview = players.map((p, i) => {
      const transfer = drawType !== 'abortive' && count > 0 && count < 4 ? (drawTenpai[i] ? 3000 / count : -3000 / (4 - count)) : 0
      return { name: p.name, delta: transfer - (roundRiichi[i] ? 1000 : 0) }
    })
    this.setData({ drawPreview, drawTenpaiCount: count })
  },

  confirmDraw() {
    this._commitRound('_applyDraw', 'manual')
  },

  _applyDraw() {
    if (this.data.drawType === 'abortive') {
      if (!GameRules.ABORT_REASONS.includes(this.data.abortReason)) {
        wx.showToast({ title: '请选择流局原因', icon: 'none' }); return
      }
      if (this.data.abortReason === '四家立直' && !this.data.roundRiichi.every(Boolean)) {
        wx.showToast({ title: '四家立直须勾选全部玩家立直', icon: 'none' }); return
      }
      const players = this.data.players.map(p => ({ ...p }))
      const sticks = this._applyRiichi(players)
      this.setData({ players, riichiSticks: this.data.riichiSticks + sticks, honba: this.data.honba + 1 })
      this.addRecord({ type: 'draw', round: `${WIND_NAMES[this.data.roundWind]}${this.data.roundNum}局 ${this.data.honba - 1}本场`,
        abortive: true, reason: this.data.abortReason, tenpai: this.data.abortReason,
        desc: '途中流局，无不听罚符，连庄加一本场' })
      this.advanceRound(true, true, true)
      this._autoSave()
      return
    }
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

  advanceRound(dealerWin, isDraw, abortive) {
    this.setData(GameRules.nextRound(this.data, dealerWin, isDraw, abortive))
    if (this.data.gameOver) this.doSettlement()
  },

  // === 结算 ===
  doSettlement() {
    this._refreshHistoryCards()
    // 已结算过则只显示弹窗，不重复计算和保存
    if (this.data.finalResult.length > 0) {
      this.setData({ showResultModal: true })
      return
    }

    const result = settle(this.data.config, this.data.players)

    this.setData({ finalResult: result, showResultModal: true })
    const last = this.data.roundHistory[this.data.roundHistory.length - 1]
    if (last && last.after && last.after.gameOver) last.after = Records.snapshot(this.data)
    this.saveHistory(result)
  },

  saveHistory(result) {
    GameStorage.saveCompleted({ ...this.data, finalResult: result })
  },

  // 自动保存当前对局进度
  _autoSave() {
    this._refreshHistoryCards()
    if (!this.data.gameOver) GameStorage.saveCurrent(this.data)
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

Page(withShare(boardDefinition))
