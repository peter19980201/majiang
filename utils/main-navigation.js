const GameStorage = require('./game-storage')

const tabs = [
  { route:'pages/index/index', label:'首页', icon:'home' },
  { route:'pages/game/history', label:'战绩', icon:'history' },
  { route:'', label:'新建', icon:'add' },
  { route:'pages/reference/reference', label:'规则', icon:'rules' },
  { route:'pages/profile/profile', label:'我的', icon:'profile' }
]

function openNewGame(afterSettled, complete = () => {}) {
  const saved = GameStorage.current()
  const open = () => wx.navigateTo({ url:'/pages/game/setup', complete })
  if (!saved || !saved.gameState || saved.gameState.gameOver) return open()
  wx.showModal({
    title:'新建对局', content:'当前对局将结算并保存到历史记录，是否继续？',
    confirmText:'新建对局',
    success(res) {
      if (!res.confirm) return complete()
      try { GameStorage.finishSavedGame(saved) } catch (error) { complete(); throw error }
      if (afterSettled) afterSettled()
      open()
    },
    fail:complete
  })
}

function syncTabBar(page) {
  if (typeof page.getTabBar !== 'function') return
  const bar = page.getTabBar()
  if (bar && typeof bar.selectRoute === 'function') bar.selectRoute(page.route)
}

module.exports = { tabs, openNewGame, syncTabBar }
