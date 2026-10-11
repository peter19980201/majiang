// Ephemeral board presentation only. Never put these fields in record snapshots.
const Mode = require('./player-mode')

function progress(state) {
  if (!state.config) return []
  const count = Mode.count(state.config)
  const current = ((state.roundCycle || 1) - 1) * count * 4 + (state.roundWind || 0) * count + (state.roundNum || 1) - 1
  // Keep one extra future stop so its incoming connector covers the right edge during a slide.
  return [-2, -1, 0, 1, 2, 3].map(offset => {
    const ordinal = current + offset
    const cycle = Math.floor(ordinal / (count * 4)) + 1
    const label = ordinal < 0 ? '' : ['东', '南', '西', '北'][Math.floor(ordinal / count) % 4] + (ordinal % count + 1)
    return { id: ordinal, label, cycle, empty: ordinal < 0 }
  })
}

function rollingPoints(from, to) {
  return Array.from({ length: 17 }, (_, step) => {
    const points = step === 16 ? to : Math.round(from + (to - from) * (1 - Math.pow(1 - step / 16, 2)))
    return { id: step, points }
  })
}

// Illustrate net transfers, including the table's riichi pool (seat -1).
// Stick counts are decorative, not denominations or another scoring engine.
function flights(deltas, players) {
  const anchors = [[50, 23], [82, 50], [50, 77], [18, 50]]
  const rows = deltas.map((amount, idx) => ({ amount, seat: players[idx].seatWind }))
  rows.push({ amount: -deltas.reduce((sum, delta) => sum + delta, 0), seat: -1 })
  const payers = rows.filter(row => row.amount < 0).map(row => ({ ...row, remaining: -row.amount }))
  const recipients = rows.filter(row => row.amount > 0).map(row => ({ ...row, remaining: row.amount }))
  const result = []
  for (const payer of payers) for (const recipient of recipients) {
    const amount = Math.min(payer.remaining, recipient.remaining)
    if (!amount) continue
    const from = payer.seat === -1 ? [50, 50] : anchors[payer.seat]
    const to = recipient.seat === -1 ? [50, 50] : anchors[recipient.seat]
    if (from && to) result.push({ id: result.length, from: payer.seat, to: recipient.seat, amount,
      fromX: from[0], fromY: from[1], toX: to[0], toY: to[1] })
    payer.remaining -= amount
    recipient.remaining -= amount
  }
  return result
}

function feedback(record, id) {
  const before = record.before
  const after = record.after
  const winners = record.winners || record.achievers ||
    (record.type !== 'draw' ? [{ idx: record.input.selectedWinner }] : [])
  const fromAngle = before.players[before.dealerIdx].seatWind * 90
  const target = after.players[after.dealerIdx].seatWind * 90
  const turn = (target - fromAngle + 360) % 360
  const deltas = after.players.map((player, i) => player.points - before.players[i].points)
  return {
    id,
    deltas,
    rolls: after.players.map((player, i) => rollingPoints(before.players[i].points, player.points)),
    flights: flights(deltas, after.players),
    winners: after.players.map((_, i) => winners.some(winner => winner.idx === i)),
    roundChanged: ['roundNum', 'roundWind', 'roundCycle', 'honba'].some(key => before[key] !== after[key]),
    dealerChanged: before.dealerIdx !== after.dealerIdx,
    progress: progress(before),
    fromAngle,
    toAngle: fromAngle + (turn > 180 ? turn - 360 : turn)
  }
}

const methods = {
  _clearRoundFeedback(render = true) {
    clearTimeout(this._roundFeedbackTimer)
    this._roundFeedbackSequence = (this._roundFeedbackSequence || 0) + 1
    if (render) this.setData({ roundFeedback: [], roundFeedbackRunning: false, roundFeedbackTransition: false, roundFeedbackAngle: null,
      roundProgressItems: progress(this.data), roundProgressMoving: false })
  },

  _playRoundFeedback(record) {
    this._clearRoundFeedback()
    const sequence = this._roundFeedbackSequence
    const effect = feedback(record, sequence)
    this.setData({ roundFeedback: [effect], roundFeedbackAngle: effect.fromAngle, roundProgressItems: effect.progress }, () => {
      if (this._roundFeedbackSequence !== sequence) return
      // Let the entry sheet finish closing before the tabletop feedback begins.
      this._roundFeedbackTimer = setTimeout(() => {
        if (this._roundFeedbackSequence !== sequence) return
        this.setData({ roundFeedbackRunning: true })
        this._roundFeedbackTimer = setTimeout(() => {
          if (this._roundFeedbackSequence !== sequence) return
          this.setData({ roundFeedbackRunning: false, roundFeedbackTransition: true, roundFeedbackAngle: effect.toAngle,
            roundProgressMoving: effect.dealerChanged })
          this._roundFeedbackTimer = setTimeout(() => {
            if (this._roundFeedbackSequence === sequence) this._clearRoundFeedback()
          }, 800)
        }, 1600)
      }, 230)
    })
  }
}

module.exports = { feedback, methods, rollingPoints, flights, progress }
