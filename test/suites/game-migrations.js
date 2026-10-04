const assert = require('assert')
const M = require('../../utils/game-migrations')
const Storage = require('../../utils/game-storage')
const { clone } = require('../../utils/game-records')
const fixtures = require('../fixtures/pre-stage-one.json')
let data, writes, failure
function reset(values) {
  data = clone(values); writes = []; failure = ''
  global.wx = {
    getStorageSync: key => data[key] === undefined ? '' : clone(data[key]),
    setStorageSync(key, value) {
      if (key === failure) throw new Error('injected storage failure')
      writes.push(key); data[key] = clone(value)
    },
    removeStorageSync: key => { delete data[key] }, showToast() {}
  }
}
const raw = clone(fixtures.manual)
delete raw.gameState.gameId
const rawRound = raw.gameState.roundHistory[0]
rawRound.version = 2; rawRound.points = 3900; rawRound.honbaBonus = 600
rawRound.yakuSummary = '立直 清一色'; delete rawRound.yaku
rawRound.input.calculatorInput = { hand: [4,4], melds: [], agariTile: 1, redM5: true }
reset({ currentGame: raw })
const upgraded = Storage.current()
assert.deepStrictEqual(data['currentGame.migration-backup'], raw)
assert.deepStrictEqual(writes, ['currentGame.migration-backup', 'currentGame'])
assert.strictEqual(upgraded.schemaVersion, M.SCHEMA_VERSION)
const round = upgraded.gameState.roundHistory[0]
assert.strictEqual(round.points, 4500)
assert.strictEqual(round.before.roundCycle, 1)
assert.strictEqual(round.correctionAvailable, true)
assert(round.yaku.every(y => y.inferred))
assert(round.input.calculatorInput.redPlacementInferred)
assert.deepStrictEqual(round.input.calculatorInput.handRed, [true, false])
assert.deepStrictEqual(upgraded.gameState.players, raw.gameState.players)
assert.deepStrictEqual(upgraded.gameState.config, raw.gameState.config, 'format migration must not switch rules')
assert.deepStrictEqual(round.before.players, rawRound.before.players)
writes = []
assert.deepStrictEqual(Storage.current(), upgraded)
assert.deepStrictEqual(writes, [], 'already migrated data must not be rewritten')
assert.strictEqual(Storage.current().gameState.gameId, upgraded.gameState.gameId)
assert.strictEqual(Storage.current().gameState.roundHistory[0].points, 4500)

const completed = { id: 123, date: raw.date, config: raw.gameState.config, result: [{ name: 'A', points: 30000 }],
  rounds: [rawRound], gameState: raw.gameState }
reset({ gameHistory: [completed] })
const history = Storage.history()
assert.strictEqual(history[0].id, '123')
assert.strictEqual(history[0].gameState.gameId, '123')
assert.deepStrictEqual(history[0].rounds, history[0].gameState.roundHistory)
assert.deepStrictEqual(history[0].result, completed.result)
assert.deepStrictEqual(data['gameHistory.migration-backup'], [completed])
writes = []; Storage.history(); assert.deepStrictEqual(writes, [])
Storage.removeHistory(123); assert.deepStrictEqual(data.gameHistory, [])

// Missing evidence stays missing; modern red positions and han stay exact.
const incomplete = M.round({ type: 'ron', version: 1, points: 1000, honbaBonus: 300, yakuSummary: '宝牌 未知役' })
assert.strictEqual(incomplete.correctionAvailable, false)
assert.strictEqual(incomplete.before, undefined)
assert.strictEqual(M.round({ type: 'ron', before: rawRound.before, input: rawRound.input }).correctionAvailable, false)
assert(incomplete.yaku.every(y => y.inferred))
assert.strictEqual(incomplete.yaku[1].han, 0)
const modern = { hand: [4,4], handRed: [false,true], agariRed: false, melds: [], redM5: true }
assert.deepStrictEqual(M.calculatorInput(modern), modern)
const accurate = M.round({ version: 4, type: 'ron', points: 4500, honbaBonus: 600, yaku: [{ name: '宝牌', han: 4 }] })
assert.strictEqual(accurate.points, 4500)
assert.deepStrictEqual(accurate.yaku, [{ name: '宝牌', han: 4 }])
assert.deepStrictEqual(M.round(accurate), accurate)

// No primary write is attempted after validation/backup failure. Main-write failure leaves the backup usable.
for (const key of ['currentGame.migration-backup', 'currentGame']) {
  reset({ currentGame: raw }); failure = key
  assert.throws(() => Storage.current(), /injected/)
  assert.deepStrictEqual(data.currentGame, raw)
  if (key.endsWith('backup')) assert.deepStrictEqual(writes, [])
  else assert.deepStrictEqual(data['currentGame.migration-backup'], raw)
  failure = ''; assert.strictEqual(Storage.current().schemaVersion, M.SCHEMA_VERSION)
}
for (const corrupt of [
  { ...raw, schemaVersion: 99 },
  { ...raw, gameState: null },
  { ...raw, gameState: { ...raw.gameState, players: [{ points: 'bad' }] } },
  { ...raw, gameState: { ...raw.gameState, roundHistory: [{ schemaVersion: 99 }] } }
]) {
  reset({ currentGame: corrupt })
  assert.throws(() => Storage.current())
  assert.deepStrictEqual(data.currentGame, corrupt)
  assert.deepStrictEqual(writes, [])
}
reset({ gameHistory: [completed, { id: 'future', schemaVersion: 99 }] })
assert.throws(() => Storage.history(), /版本/)
assert.deepStrictEqual(data.gameHistory, [completed, { id: 'future', schemaVersion: 99 }])
assert.deepStrictEqual(writes, [], 'a bad item must not partially upgrade the history list')

// Failed completed-game migration does not delete an active game.
reset({ currentGame: raw, gameHistory: [{ id: 'future', schemaVersion: 99 }] })
assert.throws(() => Storage.finishSavedGame(raw), /版本/)
assert.deepStrictEqual(data.currentGame, raw)
assert.deepStrictEqual(writes, [])
reset({ currentGame: { ...raw, schemaVersion: 99 } })
assert.throws(() => Storage.saveCurrent(upgraded.gameState), /版本/)
assert.deepStrictEqual(writes, [])
assert.throws(() => Storage.saveCompleted(upgraded.gameState), /版本/)
assert.deepStrictEqual(writes, [])
reset({})
Storage.saveCurrent(upgraded.gameState)
assert.strictEqual(data.currentGame.schemaVersion, M.SCHEMA_VERSION)
writes = []; Storage.current(); assert.deepStrictEqual(writes, [])
reset({ gameHistory: [completed] })
Storage.history(); Storage.clearHistory()
assert.deepStrictEqual(data.gameHistory, [])
assert.strictEqual(data['gameHistory.migration-backup'], undefined)
reset({})
assert.strictEqual(Storage.current(), null)
assert.deepStrictEqual(Storage.history(), [])
console.log('Migrations passed: backup-first persistence, idempotence, stable IDs, exact scores/rules, inferred metadata, missing snapshots, write failures and future/corrupt-version protection.')
