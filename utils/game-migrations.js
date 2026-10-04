// All legacy-format interpretation lives here. Format upgrades never change game rules.
const { clone, newGameId } = require('./game-records')
const { YAKU_DATA } = require('./yaku-data')
const SCHEMA_VERSION = 1
const YAKU_BY_NAME = {}
YAKU_DATA.forEach(yaku => { YAKU_BY_NAME[yaku.name] = yaku })
const DOUBLE_YAKUMAN = ['国士无双十三面', '四暗刻单骑', '大四喜', '纯正九莲宝灯']
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式错误`)
}
function version(value) {
  if (value.schemaVersion !== undefined &&
      (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 0 || value.schemaVersion > SCHEMA_VERSION)) {
    throw new Error('存档版本不受支持')
  }
}
function calculatorInput(value) {
  if (!value) return value
  object(value, '手牌输入')
  const input = clone(value)
  if (input.handRed === undefined && Array.isArray(input.hand)) {
    input.handRed = input.hand.map(() => false)
    input.agariRed = false
    input.melds = input.melds || []
    const flags = { 4: 'redM5', 13: 'redP5', 22: 'redS5' }
    Object.keys(flags).forEach(key => {
      const id = Number(key)
      if (!input[flags[id]]) return
      // Preserve the former recovery policy, but explicitly mark the inferred placement.
      input.redPlacementInferred = true
      const index = input.hand.indexOf(id)
      if (index !== -1) input.handRed[index] = true
      else if (input.agariTile === id) input.agariRed = true
      else {
        const meld = input.melds.find(m => m.tiles.includes(id))
        if (meld) {
          meld.redTiles = meld.redTiles || meld.tiles.map(() => false)
          meld.redTiles[meld.tiles.indexOf(id)] = true
        }
      }
    })
  }
  return input
}
function yaku(record) {
  if (record.yaku !== undefined && !Array.isArray(record.yaku)) throw new Error('役种数据格式错误')
  if (record.yakuSummary !== undefined && typeof record.yakuSummary !== 'string') throw new Error('役种摘要格式错误')
  if (record.yaku && record.yaku.length) return clone(record.yaku)
  const hand = record.input && record.input.calculatorInput || record.calculatorInput
  const open = Boolean(hand && (hand.melds || []).some(meld => meld.type !== 'ankan'))
  return (record.yakuSummary || '').trim().split(/\s+/).filter(Boolean).map(name => {
    const reference = YAKU_BY_NAME[name]
    return { name, han: reference ? (open && reference.hanOpen !== null ? reference.hanOpen : reference.han) :
      (DOUBLE_YAKUMAN.includes(name) ? -1 : 0),
      yakumanTimes: DOUBLE_YAKUMAN.includes(name) ? 2 : 1, inferred: true }
  })
}
function state(value) {
  object(value, '对局状态')
  version(value)
  const result = clone(value)
  if (result.roundCycle === undefined) result.roundCycle = 1
  if (!Number.isInteger(result.roundCycle) || result.roundCycle < 1) throw new Error('轮次格式错误')
  if (result.players !== undefined) {
    if (!Array.isArray(result.players) || result.players.some(p => !p || !Number.isFinite(p.points))) throw new Error('玩家点数格式错误')
  }
  if (result.roundHistory !== undefined) {
    if (!Array.isArray(result.roundHistory)) throw new Error('逐局记录格式错误')
    result.roundHistory = result.roundHistory.map(round)
  }
  if (result.gameId !== undefined) result.gameId = String(result.gameId)
  return result
}
function ronEntries(record, players, honba) {
  const input = clone(record.input)
  if (record.schemaVersion === SCHEMA_VERSION) return input.ronEntries || []
  if (record.winners && input.ronEntries && input.ronEntries.length) return input.ronEntries
  const idx = input.selectedWinner
  if (!Number.isInteger(idx) || !players[idx]) return []
  const calcResult = input.source !== 'manual' ? {
    source: input.source, quickInput: input.quickInput, calculatorInput: input.calculatorInput,
    han: record.han, fu: record.fu, level: record.level, yaku: yaku(record),
    payment: { total: Number(input.inputPoints) + honba * 300 }
  } : null
  return [{ idx, name: players[idx].name, points: input.inputPoints,
    calcResult, calculatorInput: input.calculatorInput || null }]
}
function round(value) {
  object(value, '逐局记录')
  version(value)
  if (value.points !== undefined && !Number.isFinite(value.points)) throw new Error('记录点数格式错误')
  if (value.winners !== undefined && !Array.isArray(value.winners)) throw new Error('和了者格式错误')
  if (value.input) object(value.input, '录入数据')
  if (value.schemaVersion === SCHEMA_VERSION) return value
  const record = clone(value)
  if (record.type === 'ron' && !(record.version >= 3) && record.honbaBonus !== undefined) {
    if (!Number.isFinite(record.points) || !Number.isFinite(record.honbaBonus)) throw new Error('旧记录点数格式错误')
    record.points += record.honbaBonus
  }
  record.yaku = yaku(record)
  if (record.before) record.before = state(record.before)
  if (record.after) record.after = state(record.after)
  if (record.winners) record.winners = record.winners.map(winner => ({ ...winner, yaku: yaku(winner) }))
  if (record.input) {
    const input = record.input
    if (input.calculatorInput) input.calculatorInput = calculatorInput(input.calculatorInput)
    if (input.ronEntries) input.ronEntries.forEach(entry => {
      if (entry.calculatorInput) entry.calculatorInput = calculatorInput(entry.calculatorInput)
      if (entry.calcResult && entry.calcResult.calculatorInput) entry.calcResult.calculatorInput = calculatorInput(entry.calcResult.calculatorInput)
    })
    if (record.type === 'ron' && record.before && record.before.players) {
      input.ronEntries = ronEntries(record, record.before.players, record.before.honba || 0)
    }
  }
  record.schemaVersion = SCHEMA_VERSION
  record.correctionAvailable = Boolean(record.before && record.after && record.input)
  return clone(record)
}
function current(value) {
  object(value, '当前存档')
  version(value)
  const result = clone(value)
  result.gameState = state(result.gameState)
  result.gameState.gameId = result.gameState.gameId || newGameId()
  result.gameState.gameDate = result.gameState.gameDate || result.date
  result.gameState.roundHistory = result.gameState.roundHistory || []
  result.schemaVersion = SCHEMA_VERSION
  return result
}
function history(value) {
  if (!Array.isArray(value)) throw new Error('历史存档格式错误')
  return value.map(item => {
    object(item, '历史记录')
    version(item)
    const record = clone(item)
    record.id = String(record.id === undefined ? newGameId() : record.id)
    if (record.rounds !== undefined && !Array.isArray(record.rounds)) throw new Error('历史逐局记录格式错误')
    record.rounds = (record.rounds || []).map(round)
    if (record.gameState) {
      record.gameState = state(record.gameState)
      record.gameState.gameId = record.id
      record.gameState.gameDate = record.gameState.gameDate || record.date
      record.gameState.roundHistory = record.gameState.roundHistory || clone(record.rounds)
    }
    record.schemaVersion = SCHEMA_VERSION
    return record
  })
}
module.exports = { SCHEMA_VERSION, current, history, round, state, calculatorInput, ronEntries, yaku }
