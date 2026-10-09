const GameStorage = require('./game-storage')

const tabs = [
  { route:'pages/index/index', label:'首页', icon:'home' },
  { route:'pages/game/history', label:'战绩', icon:'history' },
  { route:'', label:'新建', icon:'add' },
  { route:'pages/reference/reference', label:'规则', icon:'rules' },
  { route:'pages/profile/profile', label:'我的', icon:'profile' }
]

function openNewGame(afterSettled, complete = () => {}, showConfirmation = options => wx.showModal(options)) {
  const saved = GameStorage.current()
  const open = () => wx.navigateTo({ url:'/pages/game/setup', complete })
  if (!saved || !saved.gameState || saved.gameState.gameOver) return open()
  showConfirmation({
    title:'结算当前对局并新建？', content:'当前对局将立即结束，按现有点数结算并保存到历史记录。',
    confirmText:'结算并新建',
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
