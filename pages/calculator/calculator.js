const T = require('../../utils/tiles')
const { calculate } = require('../../utils/calculator')

Page({
  data: {
    hand: [],
    melds: [],
    agariTile: null,
    inputTarget: 'hand',

    // 场况
    bakaze: 27,
    jikaze: 27,
    agariType: 'tsumo',
    honba: 0,

    // 附加状态
    riichi: false,
    doubleRiichi: false,
    ippatsu: false,
    haitei: false,
    rinshan: false,
    chankan: false,
    tenhou: false,
    chihou: false,

    // ドラ
    dora: [],
    uraDora: [],
    redM5: false,
    redP5: false,
    redS5: false,
    doraInputType: null,

    // 副露弹窗
    showMeldModal: false,
    editingMeldType: '',
    editingMeldTiles: [],
    meldNeedCount: 0,

    // 记分板模式
    boardMode: false,
    showBoardResult: false,
    boardResult: null,
    boardSticks: 0,  // 场上供托数
    windNames: { 27: '東', 28: '南', 29: '西', 30: '北' },

    // 显示
    tileNames: T.TILE_NAMES,
    meldTypeNames: { chi: '吃', pon: '碰', minkan: '明杠', ankan: '暗杠', kakan: '加杠' },
    tileRemaining: new Array(34).fill(4),
    handCount: 0,
    maxHandCount: 13
  },

  onLoad(options) {
    if (options.mode === 'board') {
      const bakaze = parseInt(options.bakaze) || 27
      const jikaze = parseInt(options.jikaze) || 27
      const agariType = options.agariType || 'tsumo'
      const honba = parseInt(options.honba) || 0
      const riichi = parseInt(options.riichi) === 1
      const sticks = parseInt(options.sticks) || 0
      this.setData({
        boardMode: true,
        bakaze,
        jikaze,
        agariType,
        honba,
        riichi,
        boardSticks: sticks
      })
      wx.setNavigationBarTitle({ title: '录入和牌' })
    }
    this.updateRemaining()
  },

  updateRemaining() {
    const counts = new Array(34).fill(0)
    for (const t of this.data.hand) counts[t]++
    if (this.data.agariTile !== null) counts[this.data.agariTile]++
    for (const m of this.data.melds) {
      for (const t of m.tiles) counts[t]++
    }
    // 正在编辑的副露牌也要算
    for (const t of this.data.editingMeldTiles) counts[t]++
    for (const t of this.data.dora) counts[t]++
    for (const t of this.data.uraDora) counts[t]++

    const remaining = new Array(34).fill(0)
    for (let i = 0; i < 34; i++) remaining[i] = 4 - counts[i]

    const maxHand = 13 - this.data.melds.length * 3
    this.setData({
      tileRemaining: remaining,
      handCount: this.data.hand.length,
      maxHandCount: maxHand
    })
  },

  // === 选牌 ===
  selectTile(e) {
    const id = parseInt(e.currentTarget.dataset.id)
    if (this.data.tileRemaining[id] <= 0) return

    const target = this.data.inputTarget
    if (target === 'hand') {
      if (this.data.hand.length >= this.data.maxHandCount) {
        wx.showToast({ title: '手牌已满', icon: 'none' })
        return
      }
      this.setData({ hand: this.data.hand.concat([id]) })
    } else if (target === 'agari') {
      this.setData({ agariTile: id })
    }
    this.updateRemaining()
  },

  removeHandTile(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    const hand = this.data.hand.filter((_, i) => i !== idx)
    this.setData({ hand })
    this.updateRemaining()
  },

  clearHand() {
    this.setData({ hand: [] })
    this.updateRemaining()
  },

  removeAgari() {
    this.setData({ agariTile: null })
    this.updateRemaining()
  },

  switchTarget(e) {
    this.setData({ inputTarget: e.currentTarget.dataset.target })
  },

  stopBubble() {},

  // === 副露弹窗 ===
  showMeldPanel() {
    this.setData({ showMeldModal: true, editingMeldType: '', editingMeldTiles: [] })
  },

  closeMeldPanel() {
    this.setData({ showMeldModal: false, editingMeldType: '', editingMeldTiles: [] })
    this.updateRemaining()
  },

  startMeldInput(e) {
    const type = e.currentTarget.dataset.type
    const needCount = (type === 'minkan' || type === 'ankan') ? 4 : 3
    this.setData({ editingMeldType: type, editingMeldTiles: [], meldNeedCount: needCount })
  },

  selectMeldTile(e) {
    const id = parseInt(e.currentTarget.dataset.id)
    if (this.data.tileRemaining[id] <= 0) return

    const tiles = this.data.editingMeldTiles.concat([id])
    const type = this.data.editingMeldType
    const needCount = this.data.meldNeedCount

    // 碰/杠: 所有牌必须相同
    if (type === 'pon' || type === 'minkan' || type === 'ankan') {
      if (tiles.length > 1 && tiles[0] !== id) {
        wx.showToast({ title: '碰/杠需要相同的牌', icon: 'none' })
        return
      }
    }

    // 吃: 必须同花色且连续
    if (type === 'chi') {
      if (T.isJihai(id)) {
        wx.showToast({ title: '字牌不能吃', icon: 'none' })
        return
      }
      if (tiles.length > 1) {
        const suits = tiles.map(T.getSuit)
        if (!suits.every(s => s === suits[0])) {
          wx.showToast({ title: '吃需要同一花色', icon: 'none' })
          return
        }
      }
    }

    this.setData({ editingMeldTiles: tiles })
    this.updateRemaining()

    if (tiles.length >= needCount) {
      // 吃的最终校验: 排序后是否连续
      if (type === 'chi') {
        const sorted = tiles.slice().sort((a, b) => a - b)
        if (sorted[1] - sorted[0] !== 1 || sorted[2] - sorted[1] !== 1) {
          wx.showToast({ title: '吃需要连续的牌', icon: 'none' })
          this.setData({ editingMeldTiles: tiles.slice(0, -1) })
          this.updateRemaining()
          return
        }
      }
      // 添加副露
      const melds = this.data.melds.concat([{ type, tiles }])
      this.setData({
        melds,
        showMeldModal: false,
        editingMeldType: '',
        editingMeldTiles: []
      })
      this.updateRemaining()
    }
  },

  cancelMeldInput() {
    this.setData({ editingMeldType: '', editingMeldTiles: [] })
    this.updateRemaining()
  },

  removeMeld(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    const melds = this.data.melds.filter((_, i) => i !== idx)
    this.setData({ melds })
    this.updateRemaining()
  },

  // === 场况 ===
  setBakaze(e) { this.setData({ bakaze: parseInt(e.currentTarget.dataset.val) }) },
  setJikaze(e) { this.setData({ jikaze: parseInt(e.currentTarget.dataset.val) }) },
  setAgariType(e) { this.setData({ agariType: e.currentTarget.dataset.val }) },
  changeHonba(e) {
    const honba = Math.max(0, this.data.honba + parseInt(e.currentTarget.dataset.delta))
    this.setData({ honba })
  },

  toggleFlag(e) {
    const flag = e.currentTarget.dataset.flag
    const val = !this.data[flag]
    const update = { [flag]: val }
    if (flag === 'riichi' && val) update.doubleRiichi = false
    if (flag === 'doubleRiichi' && val) update.riichi = false
    if (flag === 'tenhou' && val) update.chihou = false
    if (flag === 'chihou' && val) update.tenhou = false
    this.setData(update)
  },

  // === ドラ ===
  startDoraInput(e) { this.setData({ doraInputType: e.currentTarget.dataset.type }) },
  selectDoraTile(e) {
    const id = parseInt(e.currentTarget.dataset.id)
    if (this.data.tileRemaining[id] <= 0) return
    const type = this.data.doraInputType
    if (!type) return
    this.setData({
      [type]: this.data[type].concat([id]),
      doraInputType: null
    })
    this.updateRemaining()
  },
  cancelDoraInput() {
    this.setData({ doraInputType: null })
  },
  removeDora(e) {
    const type = e.currentTarget.dataset.type
    const idx = parseInt(e.currentTarget.dataset.index)
    this.setData({ [type]: this.data[type].filter((_, i) => i !== idx) })
    this.updateRemaining()
  },
  toggleRed(e) {
    const flag = e.currentTarget.dataset.flag
    this.setData({ [flag]: !this.data[flag] })
  },

  // === 计算 ===
  doCalculate() {
    const { hand, melds, agariTile } = this.data
    const maxHand = 13 - melds.length * 3

    // 输入校验
    if (hand.length === 0) {
      wx.showToast({ title: '请输入手牌', icon: 'none' }); return
    }
    if (hand.length !== maxHand) {
      wx.showToast({ title: `手牌需要${maxHand}张，当前${hand.length}张`, icon: 'none' }); return
    }
    if (agariTile === null) {
      wx.showToast({ title: '请选择和了牌', icon: 'none' }); return
    }
    // 检查副露完整性
    for (let i = 0; i < melds.length; i++) {
      const need = (melds[i].type === 'minkan' || melds[i].type === 'ankan') ? 4 : 3
      if (melds[i].tiles.length !== need) {
        wx.showToast({ title: `第${i+1}组副露不完整`, icon: 'none' }); return
      }
    }
    // 状态合理性校验
    const hasOpenMeld = melds.some(m => m.type === 'chi' || m.type === 'pon' || m.type === 'minkan' || m.type === 'kakan')
    if ((this.data.riichi || this.data.doubleRiichi) && hasOpenMeld) {
      wx.showToast({ title: '有副露（非暗杠）时不能立直', icon: 'none' }); return
    }
    if (this.data.ippatsu && !this.data.riichi && !this.data.doubleRiichi) {
      wx.showToast({ title: '一发需要立直', icon: 'none' }); return
    }
    if (this.data.tenhou && (this.data.jikaze !== 27 || this.data.agariType !== 'tsumo')) {
      wx.showToast({ title: '天和需要庄家自摸', icon: 'none' }); return
    }
    if (this.data.chihou && (this.data.jikaze === 27 || this.data.agariType !== 'tsumo')) {
      wx.showToast({ title: '地和需要子家自摸', icon: 'none' }); return
    }
    if (this.data.rinshan && this.data.agariType !== 'tsumo') {
      wx.showToast({ title: '岭上开花需要自摸', icon: 'none' }); return
    }
    if (this.data.chankan && this.data.agariType !== 'ron') {
      wx.showToast({ title: '抢杠需要荣和', icon: 'none' }); return
    }

    const result = calculate({
      hand, melds, agariTile,
      context: {
        agariType: this.data.agariType,
        bakaze: this.data.bakaze,
        jikaze: this.data.jikaze,
        honba: this.data.honba,
        riichi: this.data.riichi || this.data.doubleRiichi,
        doubleRiichi: this.data.doubleRiichi,
        ippatsu: this.data.ippatsu,
        haitei: this.data.haitei,
        rinshan: this.data.rinshan,
        chankan: this.data.chankan,
        tenhou: this.data.tenhou,
        chihou: this.data.chihou,
        dora: this.data.dora,
        uraDora: this.data.uraDora,
        redDora: {
          m5: this.data.redM5 ? 1 : 0,
          p5: this.data.redP5 ? 1 : 0,
          s5: this.data.redS5 ? 1 : 0
        }
      }
    })

    if (result.error) {
      wx.showToast({ title: result.error, icon: 'none', duration: 2000 })
      return
    }

    // 记分板模式: 弹窗展示结果
    if (this.data.boardMode) {
      this.setData({ showBoardResult: true, boardResult: result })
      return
    }

    // 附加原始输入数据供结果页展示
    result.input = {
      hand: hand.slice().sort((a, b) => a - b),
      melds,
      agariTile,
      agariType: this.data.agariType,
      bakaze: this.data.bakaze,
      jikaze: this.data.jikaze
    }

    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(result))}`
    })
  },

  // === 记分板模式结果 ===
  confirmBoardResult() {
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.emit('calcResult', this.data.boardResult)
    wx.navigateBack()
  },

  cancelBoardResult() {
    this.setData({ showBoardResult: false })
  }
})
