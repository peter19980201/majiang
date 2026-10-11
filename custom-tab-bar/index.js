const { tabs, openNewGame } = require('../utils/main-navigation')
Component({
  data: { tabs, selected:'pages/index/index', newGameVisible:false, modePickerVisible:false },
  lifetimes: {
    attached() { this.syncRoute() },
    detached() { this.closeModePicker(); this.cancelNewGame() }
  },
  pageLifetimes: {
    show() { this.syncRoute() },
    hide() { this.closeModePicker(); this.cancelNewGame() }
  },
  methods: {
    showNewGameConfirmation(options) {
      this._confirmation = options
      this.setData({ newGameVisible:true })
    },
    cancelNewGame() { this.resolveNewGame(false) },
    confirmNewGame() { this.resolveNewGame(true) },
    resolveNewGame(confirm) {
      const pending = this._confirmation
      if (!pending) return
      this._confirmation = null
      this.setData({ newGameVisible:false })
      pending.success({ confirm, cancel:!confirm })
    },
    closeModePicker() { this.setData({ modePickerVisible:false }) },
    selectGameMode(e) {
      const playerCount = Number(e.currentTarget.dataset.count)
      if (!this.data.modePickerVisible || this._opening || ![3, 4].includes(playerCount)) return
      this._opening = true
      this.closeModePicker()
      try {
        openNewGame(null, () => { this._opening = false }, options => this.showNewGameConfirmation(options), playerCount)
      } catch (error) { this._opening = false; throw error }
    },
    blockModalTouch() {},
    syncRoute() {
      const pages = getCurrentPages()
      if (pages.length) this.selectRoute(pages[pages.length - 1].route)
    },
    selectRoute(route) {
      if (tabs.some(tab => tab.route && tab.route === route)) this.setData({ selected:route })
    },
    activate(e) {
      const tab = tabs[Number(e.currentTarget.dataset.index)]
      if (!tab) return
      if (!tab.route) {
        if (this._opening) return
        this.setData({ modePickerVisible:true })
        return
      }
      if (tab.route === this.data.selected) return
      wx.switchTab({ url:'/' + tab.route })
    }
  }
})
