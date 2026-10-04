const Records = require('./game-records')
const GameRound = require('./game-round')
const Migrations = require('./game-migrations')

// Prepare a replacement or appended record; the caller owns persistence and UI changes.
function prepare(original, entryState, editingRecord, action, source, calcResult) {
  const history = editingRecord ? original.roundHistory.slice(0, -1) : original.roundHistory.slice()
  const before = Records.snapshot(entryState)
  const evaluated = GameRound.evaluate(before, original, action, calcResult)
  if (evaluated.error) return evaluated
  const next = evaluated.state
  // An explicitly ended game stays ended after correction; undo can reopen it.
  if (editingRecord && original.gameOver &&
      (original.endReason === '手动结束' || original.endedEarly || !editingRecord.after.gameOver)) {
    next.gameOver = true
    next.endedEarly = original.config.gameType !== 'free'
    next.endReason = original.config.gameType === 'free' ? '手动结束' : original.endReason
  }
  const record = evaluated.record
  const hasQuickInput = (calcResult && calcResult.source === 'hanfu') ||
    (record.winners && original.ronEntries.some(entry => entry.calcResult && entry.calcResult.source === 'hanfu'))
  record.version = hasQuickInput ? 4 : 3
  record.id = editingRecord ? editingRecord.id : Records.newGameId()
  record.before = before
  record.after = Records.snapshot(next)
  record.input = { ...Records.input(original), roundRiichi: next.roundRiichi.slice(),
    drawType: next.drawType, abortReason: next.abortReason, source,
    quickInput: calcResult && calcResult.quickInput ? Records.clone(calcResult.quickInput) : null,
    calculatorInput: calcResult && calcResult.calculatorInput ? Records.clone(calcResult.calculatorInput) : null }
  if (calcResult) {
    const payment = calcResult.payment
    if (record.type === 'ron') record.input.inputPoints = String(payment.total - before.honba * 300)
    else {
      record.input.inputKoPayment = String(payment.koPayment - before.honba * 100)
      record.input.inputOyaPayment = payment.oyaPayment === undefined ? '' : String(payment.oyaPayment - before.honba * 100)
    }
  }
  return { state: { ...Records.snapshot(next), roundHistory: history.concat(Migrations.round(record)) } }
}

module.exports = { prepare }
