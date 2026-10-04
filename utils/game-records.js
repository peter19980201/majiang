const STATE_KEYS = ['config', 'players', 'roundWind', 'roundWindName', 'roundNum', 'roundCycle',
  'honba', 'riichiSticks', 'dealerIdx', 'gameOver', 'endedEarly', 'endReason', 'finalResult']
const INPUT_KEYS = ['selectedWinner', 'selectedLoser', 'inputPoints', 'inputKoPayment',
  'inputOyaPayment', 'roundRiichi', 'drawTenpai', 'multiRonMode', 'ronEntries', 'drawType', 'nagashiWinners', 'abortReason']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function snapshot(data) {
  const state = { roundCycle: data.roundCycle || 1 }
  STATE_KEYS.forEach(key => { if (data[key] !== undefined) state[key] = clone(data[key]) })
  return state
}

function input(data) {
  const result = {}
  INPUT_KEYS.forEach(key => { if (data[key] !== undefined) result[key] = clone(data[key]) })
  return result
}

function newGameId() {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

module.exports = { clone, snapshot, input, newGameId }
