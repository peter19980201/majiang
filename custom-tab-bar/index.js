const { tabs, openNewGame } = require('../utils/main-navigation')
Component({
  data: { tabs, selected:'pages/index/index' },
  lifetimes: {
    attached() { this.syncRoute() }
  },
  pageLifetimes: {
    show() { this.syncRoute() }
  },
  methods: {
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
        this._opening = true
        // Modal or navigation must finish before a second tap can open another page.
        try { openNewGame(null, () => { this._opening = false }) }
        catch (error) { this._opening = false; throw error }
        return
      }
      if (tab.route === this.data.selected) return
      wx.switchTab({ url:'/' + tab.route })
    }
  }
})
