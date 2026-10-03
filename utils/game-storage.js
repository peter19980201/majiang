const Records = require('./game-records')
const { settle } = require('./game-settlement')

function gameState(data) {
  return { ...Records.snapshot(data), gameId: data.gameId, gameDate: data.gameDate,
    roundHistory: data.roundHistory }
}

function history() {
  return wx.getStorageSync('gameHistory') || []
}

function removeHistory(id) {
  const records = history()
  const updated = records.filter(record => String(record.id) !== String(id))
  if (updated.length !== records.length) wx.setStorageSync('gameHistory', updated)
}

function saveCurrent(data) {
  wx.setStorageSync('currentGame', { date: data.gameDate, gameState: gameState(data) })
}

function saveCompleted(data, abandoned = false) {
  const state = gameState(data)
  const record = { id: state.gameId, date: state.gameDate, config: state.config,
    result: state.finalResult, rounds: state.roundHistory, gameState: state }
  if (abandoned) record.abandoned = true
  const records = history().filter(item => String(item.id) !== String(record.id))
  records.unshift(record)
  // Remove the current game only after the completed record has been saved.
  wx.setStorageSync('gameHistory', records)
  wx.removeStorageSync('currentGame')
  return record
}

function finishSavedGame(saved) {
  const state = saved.gameState
  return saveCompleted({ ...state, gameId: state.gameId || Records.newGameId(),
    gameDate: state.gameDate || saved.date, gameOver: true, endedEarly: state.config.gameType !== 'free', endReason: '手动结束',
    finalResult: settle(state.config, state.players) }, state.config.gameType !== 'free')
}

module.exports = { history, removeHistory, saveCurrent, saveCompleted, finishSavedGame }
