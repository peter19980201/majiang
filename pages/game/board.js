const { withShare } = require('../../utils/share')
const GameRound = require('../../utils/game-round')
const Records = require('../../utils/game-records')
const RoundView = require('../../utils/round-view')
const GameRules = require('../../utils/game-rules')
const { settle } = require('../../utils/game-settlement')
const GameStorage = require('../../utils/game-storage')
const RonEntry = require('../../utils/ron-entry')
const RoundTransaction = require('../../utils/round-transaction')

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
    roundCycle: 1,
    roundWind: 0,   // 0=東, 1=南, 2=西, 3=北
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
    recordsExpanded: false,
    // 弹窗
    recordTimeline: [],
    recordsScrollTarget: '',
    roundDetailVisible: false,
    roundDetailRecord: null,
    inputOverlayVisible: false,
    inputOverlayConfig: null,
    inputOverlayKind: '',
    showActionModal: false,
    showRonModal: false,
    showTsumoModal: false,
    showDrawModal: false,
    // 和了录入
    selectedWinner: -1,
    selectedLoser: -1,
    inputPoints: '',
    inputKoPayment: '',
    inputOyaPayment: '',
    multiRonMode: false,
    ronEntries: [],
    tsumoReady: false,
    tsumoBaseTotal: 0,
    tsumoCalcResult: null,
    ronReady: false,
    ronCompleted: 0,
    ronPendingHint: '请选择和了者和放铳者',
    ronChoices: [],
    showManualInput: false,
    // 本局立直
    roundRiichi: [false, false, false, false],
    // 流局
    drawTenpai: [false, false, false, false],
    drawPreview: [],
    drawTenpaiCount: 0,
    drawType: 'exhaustive', nagashiWinners: [false, false, false, false],
    abortReason: '九种九牌',
    abortReasons: GameRules.ABORT_REASONS,
    // 结算
    finalResult: []
  },

  onLoad(options) {
    if (options.historyId) {
      const history = GameStorage.history()
      const saved = history.find(record => String(record.id) === options.historyId)
      const current = GameStorage.current()
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
      const saved = GameStorage.current()
      if (saved && saved.gameState) {
        this.setData(saved.gameState)
        this.setData({ gameId: saved.gameState.gameId, gameDate: saved.date })
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
    return GameRound.roundLabel(this.data)
  },

  _entryState() {
    const state = this._editingRecord ? this._editingRecord.before : this.data
    return { ...state, config: this.data.config.gameType === 'free' ? { ...state.config, gameType: 'free' } : state.config }
  },

  _prepareEntry() {
    const state = this._entryState()
    this.setData({ entryHonba: state.honba, entryRiichiSticks: state.riichiSticks,
      entryDealerIdx: state.dealerIdx,
      entryRoundLabel: GameRound.roundLabel(state),
      abortReasons: GameRules.ABORT_REASONS })
  },

  _refreshRonChoices() {
    this.setData(RonEntry.view(this.data.ronEntries, this.data.players, this.data.selectedLoser))
  },

  _setRonEntries(ronEntries) {
    this.setData({ ronEntries })
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
    this._setRonEntries(ronEntries)
  },

  openMultiRonPoints(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ ronEntries: this.data.ronEntries.map(entry => ({ ...entry,
      editingPoints: entry.idx === idx,
      draftPoints: entry.idx === idx ? entry.points || '' : entry.draftPoints })) })
    this._refreshRonChoices()
  },

  editRonEntry(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ ronEntries: this.data.ronEntries.map(entry => ({ ...entry,
      editingMethods: entry.idx === idx ? !entry.editingMethods : false })) })
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
        editingPoints: false, editingMethods: false, draftPoints: '' } : item) })
    this._setRonEntries(this.data.ronEntries)
  },

  goToMultiCalc(e, mode) {
    if (this.data.selectedLoser < 0) {
      wx.showToast({ title: '请先选择放铳者', icon: 'none' }); return
    }
    this._navigateToCalc('ron', mode, true, Number(e.currentTarget.dataset.idx))
  },

  selectDrawType(e) {
    const drawType = e.currentTarget.dataset.type
    if (!['exhaustive', 'abortive', 'nagashi'].includes(drawType)) return
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
  _commitRound(action, source, calcResult) {
    if (this.data.gameOver && !this._editingRecord) return
    if (!this._canWriteGame()) return
    const prepared = RoundTransaction.prepare(this.data, this._entryState(), this._editingRecord, action, source, calcResult)
    if (prepared.error) {
      wx.showToast({ title: prepared.error, icon: 'none' })
      return
    }
    this._editingRecord = null
    this.setData({ ...prepared.state,
      editingLastRound: false, showRonModal: false, showTsumoModal: false, showDrawModal: false,
      roundRiichi: [false, false, false, false] })
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
    const saved = GameStorage.current()
    if (saved && saved.gameState && saved.gameState.gameId !== this.data.gameId) {
      wx.showToast({ title: '另一场对局进行中，请先结束', icon: 'none' })
      return false
    }
    return true
  },

  toggleRecords() {
    const recordsExpanded = !this.data.recordsExpanded
    this.setData({ recordsExpanded, recordsScrollTarget: recordsExpanded ? 'record-list-top' : '' })
  },

  _refreshHistoryCards() {
    const historyCards = this.data.roundHistory.map((record, index, records) =>
      RoundView.card(record, index === records.length - 1))
    const recordTimeline = historyCards.map((card, index) => {
      const record = this.data.roundHistory[index]
      const players = record.before ? record.before.players : this.data.players
      const indices = record.winners ? record.winners.map(winner => winner.idx) :
        [record.input && Number.isInteger(record.input.selectedWinner) ? record.input.selectedWinner : players.findIndex(p => p.name === record.winner)]
      return { ...card, recordIndex: index, seatTiles: indices.filter(i => players[i]).map(i => 27 + players[i].seatWind) }
    }).reverse()
    this.setData({ historyCards, recordTimeline })
  },

  openRoundDetail(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0 || index >= this.data.roundHistory.length) return
    const record = this.data.roundHistory[index]
    if (!record) return
    this._detailSource = record
    this.setData({ roundDetailRecord: RoundView.describe(record, index === this.data.roundHistory.length - 1),
      roundDetailVisible: true })
  },

  closeRoundDetail() {
    this.setData({ roundDetailVisible: false })
    this._detailSource = null
  },

  editDetailRound() {
    const record = this._detailSource
    if (!record || record !== this.data.roundHistory[this.data.roundHistory.length - 1]) return
    this.closeRoundDetail()
    this.editLastRound()
  },

  deleteDetailRound() {
    const record = this._detailSource
    if (!record || record !== this.data.roundHistory[this.data.roundHistory.length - 1]) return
    this.closeRoundDetail()
    this._restoreLastRound(record)
  },

  _restoreLastRound(record) {
    if (this._editingRecord || !record || !record.correctionAvailable) return
    if (this.data.roundHistory[this.data.roundHistory.length - 1] !== record) return
    if (!this._canWriteGame()) return
    this.setData({ ...Records.clone(record.before), roundHistory: this.data.roundHistory.slice(0, -1),
      finalResult: [], gameOver: false,
      roundRiichi: [false, false, false, false] })
    this._removeSavedSettlement()
    this._autoSave()
  },

  undoLastRound() {
    if (this._editingRecord) return
    const record = this.data.roundHistory[this.data.roundHistory.length - 1]
    if (!record) return
    if (!record.correctionAvailable) {
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
    if (!record.correctionAvailable) {
      wx.showToast({ title: '这条旧记录暂不支持修改', icon: 'none' })
      return
    }
    this._editingRecord = Records.clone(record)
    this.setData({ multiRonMode: false, ronEntries: [], drawType: 'exhaustive', nagashiWinners: [false, false, false, false], abortReason: '九种九牌',
      ...Records.clone(record.input), editingLastRound: true,
      showManualInput: record.input.source === 'manual',
      showRonModal: record.type === 'ron', showTsumoModal: record.type === 'tsumo',
      showDrawModal: record.type === 'draw' })
    this.setData({ tsumoCalcResult: null })
    this._prepareEntry()
    this._refreshTsumoEntry()
    if (record.type === 'ron') this._setRonEntries(RonEntry.restore(record, this.data.players, this._entryState().honba))
    if (record.type === 'draw') this.updateDrawPreview()
  },

  changeEditType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ showRonModal: type === 'ron', showTsumoModal: type === 'tsumo',
      showDrawModal: type === 'draw' })
    if (type === 'draw') this.updateDrawPreview()
    if (type === 'tsumo') this._refreshTsumoEntry()
  },

  _cancelEntry() {
    this._editingRecord = null
    this.setData({ editingLastRound: false, showRonModal: false, showTsumoModal: false,
      showDrawModal: false, roundRiichi: [false, false, false, false] })
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
      title: '结束对局',
      content: '确定结束对局，并按当前点棒结算吗？',
      success: (res) => {
        if (res.confirm) {
          if (!this._canWriteGame()) return
          this.setData({ showActionModal: false, gameOver: true, endedEarly: false, endReason: '手动结束' })
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
    const entries = this.data.ronEntries.map(entry =>
      entry.idx === this.data.selectedWinner ? { ...entry, points: e.detail.value, calcResult: null, calculatorInput: null } : entry)
    if (entries.length) this._setRonEntries(entries)
    else this.setData({ inputPoints: e.detail.value })
  },

  confirmRon() {
    if (this.data.ronEntries.length) this._refreshRonChoices()
    if (this.data.ronEntries.some(entry => entry.editingPoints)) {
      wx.showToast({ title: '请先保存正在输入的点数', icon: 'none' }); return
    }
    const single = !this.data.multiRonMode && this.data.ronEntries.find(entry => entry.idx === this.data.selectedWinner)
    if (single && single.calcResult) {
      this._processCalcRon(single.calcResult)
      return
    }
    this._commitRound(this.data.multiRonMode ? 'multiRon' : 'ron', 'manual')
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

  _navigateToCalc(agariType, mode, returnToEntry = false, winner = this.data.selectedWinner) {
    const quick = mode === 'quick'
    const { roundWind, dealerIdx, honba, riichiSticks } = this._entryState()
    const selectedWinner = winner
    const { roundRiichi } = this.data
    const bakaze = 27 + roundWind
    const jikaze = 27 + ((selectedWinner - dealerIdx + 4) % 4)
    const winnerRiichi = roundRiichi[selectedWinner] ? 1 : 0
    // 计算总供托数 (已有 + 本局新增)
    let newSticks = 0
    for (let i = 0; i < 4; i++) if (roundRiichi[i]) newSticks++
    const totalSticks = riichiSticks + newSticks

    const that = this
    const multi = agariType === 'ron' && this.data.ronEntries.length > 1
    const multiEntry = multi && this.data.ronEntries.find(entry => entry.idx === selectedWinner)
    const singleEntry = !multi && agariType === 'ron' && this.data.ronEntries.find(entry => entry.idx === selectedWinner)
    const tsumoResult = agariType === 'tsumo' && this.data.tsumoCalcResult
    const calculatorInput = tsumoResult ? tsumoResult.calculatorInput : multi ? multiEntry && multiEntry.calculatorInput : singleEntry ? singleEntry.calculatorInput :
      this._editingRecord && this._editingRecord.input.calculatorInput
    const quickInput = tsumoResult ? tsumoResult.quickInput : multi ? multiEntry && multiEntry.calcResult && multiEntry.calcResult.quickInput : singleEntry ? singleEntry.calcResult && singleEntry.calcResult.quickInput :
      this._editingRecord && this._editingRecord.input.quickInput
    if (!(agariType === 'ron' ? this.data.showRonModal : this.data.showTsumoModal)) {
      this.setData({ showRonModal: agariType === 'ron', showTsumoModal: agariType === 'tsumo' })
    }

    this._openInputOverlay({
      kind: quick ? 'quick' : 'hand',
      options: { mode: 'board', agariType, bakaze, jikaze, honba, riichi: winnerRiichi, sticks: totalSticks },
      restore: Records.clone((quick ? quickInput : calculatorInput) || null),
      onResult(data) {
        if (returnToEntry && agariType === 'tsumo') {
          const riichi = that.data.roundRiichi.slice()
          if (data.calculatorInput) riichi[selectedWinner] = Boolean(data.calculatorInput.riichi || data.calculatorInput.doubleRiichi)
          that.setData({ tsumoCalcResult: data, showManualInput: false, roundRiichi: riichi,
            inputKoPayment: String(data.payment.koPayment - honba * 100),
            inputOyaPayment: selectedWinner === that.data.entryDealerIdx ? '' : String(data.payment.oyaPayment - honba * 100) })
          that._refreshTsumoEntry()
          return
        }
        if (multi || returnToEntry) {
          const ronEntries = that.data.ronEntries.map(entry => entry.idx === selectedWinner ?
            { ...entry, points: String(data.payment.total - honba * 300),
              calculatorInput: data.calculatorInput || null, calcResult: data, editingPoints: false, editingMethods: false, draftPoints: '' } : entry)
          const riichi = that.data.roundRiichi.slice()
          if (data.calculatorInput) riichi[selectedWinner] = Boolean(data.calculatorInput.riichi || data.calculatorInput.doubleRiichi)
          that.setData({ roundRiichi: riichi, showRonModal: true })
          that._setRonEntries(ronEntries)
          return
        }
        if (agariType === 'ron') {
          that._processCalcRon(data)
        } else {
          that._processCalcTsumo(data)
        }
      }
    })
  },

  _openInputOverlay(request) {
    clearTimeout(this._inputOverlayTimer)
    const sequence = this._inputOverlaySequence = (this._inputOverlaySequence || 0) + 1
    const { options, restore, kind, onResult } = request
    this._inputOverlayResult = onResult
    this.setData({ inputOverlayVisible: false, inputOverlayConfig: null }, () => {
      if (this._inputOverlaySequence !== sequence) return
      this.setData({ inputOverlayConfig: { options, restore },
        inputOverlayKind: kind }, () => {
        wx.nextTick(() => {
          if (this._inputOverlaySequence === sequence) this.setData({ inputOverlayVisible: true })
        })
      })
    })
  },

  closeInputOverlay() {
    const sequence = this._inputOverlaySequence = (this._inputOverlaySequence || 0) + 1
    this._inputOverlayResult = null
    this.setData({ inputOverlayVisible: false })
    clearTimeout(this._inputOverlayTimer)
    this._inputOverlayTimer = setTimeout(() => {
      if (this._inputOverlaySequence === sequence) this.setData({ inputOverlayConfig: null, inputOverlayKind: '' })
    }, 220)
  },

  receiveInputOverlayResult(e) {
    const receive = this._inputOverlayResult
    if (!receive) return
    this.closeInputOverlay()
    receive(e.detail)
  },

  onUnload() {
    clearTimeout(this._inputOverlayTimer)
    this._inputOverlaySequence = (this._inputOverlaySequence || 0) + 1
  },

  _processCalcRon(calcResult) {
    this._commitRound('calcRon', calcResult.source === 'hanfu' ? 'hanfu' : 'calculator', calcResult)
  },

  _processCalcTsumo(calcResult) {
    this._commitRound('calcTsumo', calcResult.source === 'hanfu' ? 'hanfu' : 'calculator', calcResult)
  },

  // === 自摸 ===
  startTsumo() {
    this._prepareEntry()
    this.setData({ showActionModal: false })
    setTimeout(() => {
      this.setData({
        showTsumoModal: true,
        tsumoCalcResult: null, tsumoReady: false, tsumoBaseTotal: 0,
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

  goToTsumoCardHand() { this._navigateToCalc('tsumo', undefined, true) },
  goToTsumoCardQuick() { this._navigateToCalc('tsumo', 'quick', true) },

  _refreshTsumoEntry() {
    const ko = Number(this.data.inputKoPayment)
    const oya = this.data.selectedWinner === this.data.entryDealerIdx ? ko : Number(this.data.inputOyaPayment)
    const valid = n => Number.isSafeInteger(n) && n > 0 && n % 100 === 0
    const ready = this.data.selectedWinner >= 0 && valid(ko) && valid(oya)
    this.setData({ tsumoReady: ready, tsumoBaseTotal: ready ? ko * 2 + oya : 0 })
  },

  selectTsumoWinner(e) {
    const selectedWinner = parseInt(e.currentTarget.dataset.idx)
    if (selectedWinner !== this.data.selectedWinner) {
      this.setData({ selectedWinner, inputKoPayment: '', inputOyaPayment: '', tsumoCalcResult: null })
      this._refreshTsumoEntry()
    }
  },

  onKoPaymentInput(e) {
    this.setData({ inputKoPayment: e.detail.value, tsumoCalcResult: null })
    this._refreshTsumoEntry()
  },

  onOyaPaymentInput(e) {
    this.setData({ inputOyaPayment: e.detail.value, tsumoCalcResult: null })
    this._refreshTsumoEntry()
  },

  confirmTsumo() {
    if (this.data.tsumoCalcResult) { this._processCalcTsumo(this.data.tsumoCalcResult); return }
    this._commitRound('tsumo', 'manual')
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
        drawType: 'exhaustive', nagashiWinners: [false, false, false, false],
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

  toggleNagashi(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return
    const selected = (this.data.nagashiWinners || [false, false, false, false]).slice()
    selected[idx] = !selected[idx]
    this.setData({ nagashiWinners: selected })
    this.updateDrawPreview()
  },

  updateDrawPreview() {
    const { drawTenpai, roundRiichi, drawType } = this.data
    const { players } = this._entryState()
    const count = drawTenpai.filter(Boolean).length
    const transfers = drawType === 'nagashi' ? GameRound.nagashiTransfers(this.data.nagashiWinners, this._entryState().dealerIdx) : GameRound.drawTransfers(drawTenpai, drawType === 'abortive')
    const drawPreview = players.map((p, i) => ({
      name: p.name, delta: transfers[i] - (roundRiichi[i] ? 1000 : 0)
    }))
    this.setData({ drawPreview, drawTenpaiCount: count })
  },

  confirmDraw() {
    this._commitRound('draw', 'manual')
  },

  closeDraw() {
    this._cancelEntry()
  },

  // === 局进行 ===

  advanceRound(dealerWin, isDraw, abortive) {
    this.setData(GameRules.nextRound(this.data, dealerWin, isDraw, abortive))
    if (this.data.gameOver) this.doSettlement()
  },

  // === 结算 ===
  doSettlement() {
    this._refreshHistoryCards()
    // 已结算过则只打开结算页，不重复计算和保存
    if (this.data.finalResult.length > 0) {
      this.openSettlement()
      return
    }

    const result = settle(this.data.config, this.data.players)

    this.setData({ finalResult: result })
    const last = this.data.roundHistory[this.data.roundHistory.length - 1]
    if (last && last.after && last.after.gameOver) last.after = Records.snapshot(this.data)
    this.saveHistory(result)
    this.openSettlement()
  },

  openSettlement() {
    wx.navigateTo({ url: `/pages/settlement/settlement?id=${encodeURIComponent(this.data.gameId)}&source=board` })
  },

  saveHistory(result) {
    GameStorage.saveCompleted({ ...this.data, finalResult: result })
  },

  // 自动保存当前对局进度
  _autoSave() {
    if (!this.data.gameOver) this.setData({ config: { ...this.data.config, gameType: 'free' } })
    this._refreshHistoryCards()
    if (!this.data.gameOver) GameStorage.saveCurrent(this.data)
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/game/history' })
  }
}

Page(withShare(boardDefinition))
