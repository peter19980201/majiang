const Records = require('./game-records')
const Migrations = require('./game-migrations')
const { settle } = require('./game-settlement')

function gameState(data) {
  return { ...Records.snapshot(data), gameId: data.gameId, gameDate: data.gameDate,
    roundHistory: data.roundHistory }
}

// Back up the exact previous dataset before replacing it. Failure aborts the caller
// so no page can continue with a partially persisted migration or overwrite newer data.
function read(key, migrate, empty) {
  try {
    const raw = wx.getStorageSync(key)
    if (raw === '' || raw === undefined || raw === null) return empty
    const upgraded = migrate(raw)
    if (JSON.stringify(upgraded) !== JSON.stringify(raw)) {
      wx.setStorageSync(`${key}.migration-backup`, Records.clone(raw))
      wx.setStorageSync(key, upgraded)
    }
    return upgraded
  } catch (error) {
    if (wx.showToast) wx.showToast({ title: '存档读取或升级失败，原数据已保留', icon: 'none' })
    throw error
  }
}
function current() { return read('currentGame', Migrations.current, null) }
function clearHistory() {
  wx.setStorageSync('gameHistory', [])
  wx.removeStorageSync('gameHistory.migration-backup')
}
function history() { return read('gameHistory', Migrations.history, []) }


function removeHistory(id) {
  const records = history()
  const updated = records.filter(record => String(record.id) !== String(id))
  if (updated.length !== records.length) wx.setStorageSync('gameHistory', updated)
}

function saveCurrent(data) {
  current() // Validate/upgrade an existing archive before any replacement.
  wx.setStorageSync('currentGame', Migrations.current({ date: data.gameDate, gameState: gameState(data) }))
}

function saveCompleted(data, abandoned = false) {
  const state = gameState(data)
  const record = Migrations.history([{ id: state.gameId, date: state.gameDate, config: state.config,
    result: state.finalResult, rounds: state.roundHistory, gameState: state }])[0]
  if (abandoned) record.abandoned = true
  const records = history().filter(item => String(item.id) !== String(record.id))
  records.unshift(record)
  current() // Never erase a current archive from an unsupported future version.
  // Remove the current game only after the completed record has been saved.
  wx.setStorageSync('gameHistory', records)
  wx.removeStorageSync('currentGame')
  return record
}

function finishSavedGame(saved) {
  const state = Migrations.current(saved).gameState
  return saveCompleted({ ...state, gameId: state.gameId,
    gameDate: state.gameDate || saved.date, gameOver: true, endedEarly: state.config.gameType !== 'free', endReason: '手动结束',
    finalResult: settle(state.config, state.players) }, state.config.gameType !== 'free')
}

module.exports = { current, history, clearHistory, removeHistory, saveCurrent, saveCompleted, finishSavedGame }
