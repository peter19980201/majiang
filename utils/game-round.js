// One round is evaluated on an isolated state, without Page, setData, storage or wx.
const Records = require('./game-records')
const { sortedYaku } = require('./yaku-records')
const GameRules = require('./game-rules')

class InvalidRound extends Error {}

function roundLabel(state) {
  return `${state.roundCycle > 1 ? '第' + state.roundCycle + '轮 · ' : ''}${['東', '南', '西', '北'][state.roundWind]}${state.roundNum}局 ${state.honba}本场`
}

function drawTransfers(tenpai, abortive = false) {
  const count = tenpai.filter(Boolean).length
  return tenpai.map(ready => !abortive && count > 0 && count < 4 ?
    (ready ? 3000 / count : -3000 / (4 - count)) : 0)
}

// Each qualifier receives mangan from all three opponents, including other qualifiers.
// Draw treatment: no honba payment, deposits carry over, dealer tenpai governs continuation.
function nagashiTransfers(selected, dealerIdx) {
  if (!Array.isArray(selected) || selected.length !== 4 || selected.some(v => typeof v !== 'boolean') ||
      !Number.isInteger(dealerIdx) || dealerIdx < 0 || dealerIdx > 3) throw new InvalidRound('请选择有效的流局满贯达成者')
  const deltas = [0, 0, 0, 0]
  selected.forEach((qualifies, winner) => {
    if (!qualifies) return
    deltas.forEach((_, payer) => {
      if (payer === winner) return
      const amount = winner === dealerIdx || payer === dealerIdx ? 4000 : 2000
      deltas[payer] -= amount
      deltas[winner] += amount
    })
  })
  return deltas
}

function advanceRound(state, dealerContinues, isDraw, abortive) {
  Object.assign(state, GameRules.nextRound(state, dealerContinues, isDraw, abortive))
}

function applyMultiRon(state) {
  const { ronEntries, selectedLoser, players: current } = state
  const validSeat = idx => Number.isInteger(idx) && idx >= 0 && idx < current.length
  if (!validSeat(selectedLoser) ||
      ronEntries.length < 2 || ronEntries.length > 3 ||
      new Set(ronEntries.map(entry => entry.idx)).size !== ronEntries.length ||
      ronEntries.some(entry => !validSeat(entry.idx) || entry.idx === selectedLoser)) {
    throw new InvalidRound('请选择放铳者及两至三位和了者')
  }
  if (ronEntries.some(entry => !Number.isSafeInteger(Number(entry.points)) ||
      Number(entry.points) <= 0 || Number(entry.points) % 100 !== 0)) {
    throw new InvalidRound('请填写各家点数（100的倍数）')
  }
  const players = current.map(p => ({ ...p }))
  const sticks = state.riichiSticks + applyRiichi(state, players)
  const winners = ronEntries.map(entry => ({ idx: entry.idx, name: players[entry.idx].name,
    points: Number(entry.points), payment: Number(entry.points) + state.honba * 300,
    source: entry.calcResult && entry.calcResult.source === 'hanfu' ? 'hanfu' : entry.calcResult ? 'calculator' : 'manual',
    han: entry.calcResult ? entry.calcResult.han : null, fu: entry.calcResult ? entry.calcResult.fu : null,
    level: entry.calcResult ? entry.calcResult.level : '',
    yaku: entry.calcResult ? sortedYaku(entry.calcResult) : [] }))
  winners.forEach(winner => {
    players[winner.idx].points += winner.payment
    players[selectedLoser].points -= winner.payment
  })
  const nearest = winners.slice().sort((a, b) =>
    ((a.idx - selectedLoser + 4) % 4) - ((b.idx - selectedLoser + 4) % 4))[0]
  players[nearest.idx].points += sticks * 1000
  Object.assign(state, { players, riichiSticks: 0 })
  state.roundHistory.push({ type: 'ron', round: roundLabel(state), winner: winners.map(p => p.name).join('、'),
    winners, loser: players[selectedLoser].name, points: winners.reduce((sum, p) => sum + p.payment, 0),
    basePayment: winners.reduce((sum, p) => sum + p.points, 0),
    honbaBonus: state.honba * 300 * winners.length,
    riichiCollected: sticks, riichiRecipient: nearest.name,
    desc: winners.map(p => `${p.name} ${p.payment}点`).join(' / ') + `；供托归${nearest.name}` })
  advanceRound(state, winners.some(p => p.idx === state.dealerIdx))
}

function applyRiichi(state, players) {
  const riichi = state.roundRiichi
  let newSticks = 0
  for (let i = 0; i < 4; i++) {
    if (riichi[i]) {
      players[i].points -= 1000
      newSticks++
    }
  }
  return newSticks
}

function applyManualRon(state) {
  const { selectedWinner, selectedLoser, inputPoints } = state
  const pts = Number(inputPoints)
  const validSeat = idx => Number.isInteger(idx) && idx >= 0 && idx < state.players.length
  if (!validSeat(selectedWinner) || !validSeat(selectedLoser)) {
    throw new InvalidRound('请完善信息')
  }
  if (!Number.isSafeInteger(pts) || pts <= 0 || pts % 100 !== 0) {
    throw new InvalidRound('点数须为正数且是100的倍数')
  }
  if (selectedWinner === selectedLoser) {
    throw new InvalidRound('和了者和放铳者不能相同')
  }

  applyWin(state, { type: 'ron', total: pts + state.honba * 300 })
}

function applyCalcRon(state, calcResult) {
  applyWin(state, { ...calcResult.payment, type: 'ron' }, calcResult)
}

function applyCalcTsumo(state, calcResult) {
  applyWin(state, { ...calcResult.payment, type: 'tsumo' }, calcResult)
}

function applyWin(state, payment, calcResult) {
  const { selectedWinner, selectedLoser, dealerIdx, honba } = state
  const validSeat = idx => Number.isInteger(idx) && idx >= 0 && idx < state.players.length
  const validPayment = value => Number.isSafeInteger(value) && value > 0 && value % 100 === 0
  const isTsumo = payment.type === 'tsumo'
  if (!validSeat(selectedWinner) || (!isTsumo &&
      (!validSeat(selectedLoser) || selectedWinner === selectedLoser))) {
    throw new InvalidRound('请选择有效的和了者及放铳者')
  }
  const amounts = state.players.map((_, idx) => {
    if (idx === selectedWinner) return 0
    if (isTsumo) return idx === dealerIdx ? payment.oyaPayment : payment.koPayment
    return idx === selectedLoser ? payment.total : 0
  })
  if (!amounts.filter((_, idx) => idx !== selectedWinner && (isTsumo || idx === selectedLoser)).every(validPayment)) {
    throw new InvalidRound('支付额须为正数且是100的倍数')
  }
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  if (total !== payment.total) {
    throw new InvalidRound('支付额与总点数不一致')
  }
  const players = state.players.map(p => ({ ...p }))
  const allSticks = state.riichiSticks + applyRiichi(state, players)
  amounts.forEach((amount, idx) => { players[idx].points -= amount })
  players[selectedWinner].points += total + allSticks * 1000
  const record = {
    type: payment.type, round: roundLabel(state), winner: players[selectedWinner].name,
    points: total, basePayment: total - honba * 300, honbaBonus: honba * 300,
    riichiCollected: allSticks
  }
  if (isTsumo) {
    record.desc = selectedWinner === dealerIdx ? `子家各付${payment.koPayment}点` :
      `庄家${payment.oyaPayment}点/子家${payment.koPayment}点`
  } else record.loser = players[selectedLoser].name
  if (calcResult) {
    Object.assign(record, { han: calcResult.han, fu: calcResult.fu, level: calcResult.level,
      yaku: Records.clone(calcResult.yaku || []),
      yakuSummary: (calcResult.yaku || []).map(y => y.name).join(' ') })
  }
  Object.assign(state, { players, riichiSticks: 0 })
  state.roundHistory.push(record)
  advanceRound(state, selectedWinner === dealerIdx)
}

function applyManualTsumo(state) {
  const { selectedWinner, inputKoPayment, inputOyaPayment } = state
  if (!Number.isInteger(selectedWinner) || selectedWinner < 0 || selectedWinner >= state.players.length) {
    throw new InvalidRound('请选择和了者')
  }

  const isOya = selectedWinner === state.dealerIdx
  const koPayment = Number(inputKoPayment)
  const oyaPayment = isOya ? koPayment : Number(inputOyaPayment)
  const validPayment = value => Number.isSafeInteger(value) && value > 0 && value % 100 === 0
  if (!validPayment(koPayment) || !validPayment(oyaPayment)) {
    throw new InvalidRound('支付额须为正数且是100的倍数')
  }
  const bonus = state.honba * 100
  applyWin(state, { type: 'tsumo', koPayment: koPayment + bonus,
    oyaPayment: oyaPayment + bonus,
    total: (isOya ? koPayment * 3 : koPayment * 2 + oyaPayment) + bonus * 3 })
}

function applyDraw(state) {
  if (state.drawType === 'nagashi') {
    const selected = state.nagashiWinners
    const transfers = nagashiTransfers(selected, state.dealerIdx)
    if (!selected.some(Boolean)) throw new InvalidRound('请至少选择一位流局满贯达成者')
    if (!Array.isArray(state.drawTenpai) || state.drawTenpai.length !== 4 || state.drawTenpai.some(v => typeof v !== 'boolean')) {
      throw new InvalidRound('请确认听牌情况')
    }
    const round = roundLabel(state)
    const players = state.players.map(p => ({ ...p }))
    const sticks = applyRiichi(state, players)
    transfers.forEach((delta, idx) => { players[idx].points += delta })
    const achievers = players.flatMap((p, idx) => selected[idx] ? [{ idx, name: p.name,
      payment: idx === state.dealerIdx ? 12000 : 8000 }] : [])
    state.roundHistory.push({ type: 'draw', nagashi: true, round, achievers,
      tenpai: state.drawTenpai[state.dealerIdx] ? '庄家听牌，连庄' : '庄家不听，轮庄',
      desc: achievers.map(p => `${p.name} 流局满贯 ${p.payment}点`).join('；') + '；不计本场点，供托留至下一局',
      nagashiRule: 'draw-mangan-v1' })
    Object.assign(state, { players, riichiSticks: state.riichiSticks + sticks, honba: state.honba + 1 })
    advanceRound(state, state.drawTenpai[state.dealerIdx], true)
    return
  }
  if (state.drawType === 'abortive') {
    if (!GameRules.ABORT_REASONS.includes(state.abortReason)) {
      throw new InvalidRound('请选择流局原因')
    }
    if (state.abortReason === '四家立直' && !state.roundRiichi.every(Boolean)) {
      throw new InvalidRound('四家立直须勾选全部玩家立直')
    }
    const round = roundLabel(state)
    const players = state.players.map(p => ({ ...p }))
    const sticks = applyRiichi(state, players)
    Object.assign(state, { players, riichiSticks: state.riichiSticks + sticks, honba: state.honba + 1 })
    state.roundHistory.push({ type: 'draw', round,
      abortive: true, reason: state.abortReason, tenpai: state.abortReason,
      desc: '途中流局，无不听罚符，连庄加一本场' })
    advanceRound(state, true, true, true)
    return
  }
  const tenpai = state.drawTenpai
  const players = state.players.map(p => ({ ...p }))

  // 处理本局立直 (流局时立直棒累积到供托，不被收走)
  const newSticks = applyRiichi(state, players)

  drawTransfers(tenpai).forEach((delta, idx) => { players[idx].points += delta })

  const tenpaiNames = players.filter((_, i) => tenpai[i]).map(p => p.name)
  const record = {
    type: 'draw',
    round: roundLabel(state),
    tenpai: tenpaiNames.length > 0 ? tenpaiNames.join('、') + '听牌' : '全员不听'
  }

  // 流局: 庄家听牌=连庄, 否则轮庄
  const dealerTenpai = tenpai[state.dealerIdx]
  // 流局立直棒累积到供托
  Object.assign(state, { players, riichiSticks: state.riichiSticks + newSticks })
  state.roundHistory.push(record)

  // 流局本场数+1
  const honba = state.honba + 1
  Object.assign(state, { honba })
  advanceRound(state, dealerTenpai, true)
}

const actions = { ron: applyManualRon, tsumo: applyManualTsumo, multiRon: applyMultiRon,
  calcRon: applyCalcRon, calcTsumo: applyCalcTsumo, draw: applyDraw }

// Invalid input returns a user-facing error and never changes the supplied state/input.
function evaluate(before, input, action, calcResult) {
  if (!Object.prototype.hasOwnProperty.call(actions, action)) throw new Error(`Unknown round action: ${action}`)
  const state = { ...Records.snapshot(before), ...Records.input(input),
    roundHistory: [], gameOver: false, finalResult: [] }
  if (calcResult && calcResult.calculatorInput) {
    state.roundRiichi[state.selectedWinner] = Boolean(
      calcResult.calculatorInput.riichi || calcResult.calculatorInput.doubleRiichi)
  }
  try {
    actions[action](state, calcResult)
    return { state, record: state.roundHistory[0] }
  } catch (error) {
    if (error instanceof InvalidRound) return { error: error.message }
    throw error
  }
}

module.exports = { evaluate, drawTransfers, nagashiTransfers, roundLabel }
