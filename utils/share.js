const TITLE = '日麻计分搭档｜手牌算分 · 对局记分'
const IMAGE_URL = '/assets/home/quick-score.jpg'
const HOME_PATH = '/pages/index/index'
const { syncTabBar } = require('./main-navigation')

// 朋友圈只能打开当前页面，因此仅在首页启用，避免分享依赖本地数据的页面。
function withShare(definition, { timeline = false } = {}) {
  const onShow = definition.onShow
  const shared = {
    ...definition,
    onShow(...args) {
      syncTabBar(this)
      wx.showShareMenu({
        menus: timeline ? ['shareAppMessage', 'shareTimeline'] : ['shareAppMessage']
      })
      if (onShow) return onShow.apply(this, args)
    },
    onShareAppMessage() {
      return { title: TITLE, path: HOME_PATH, imageUrl: IMAGE_URL }
    }
  }
  if (timeline) {
    shared.onShareTimeline = function () {
      return { title: TITLE, query: '', imageUrl: IMAGE_URL }
    }
  }
  return shared
}

module.exports = { withShare }
