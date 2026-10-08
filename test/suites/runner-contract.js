const assert = require('node:assert/strict')
const { execute, validate, snapshot } = require('../harness/runner')
const fs = require('node:fs')
const path = require('node:path')
const manifest = require('../manifest.json')
validate(manifest)
assert.throws(() => validate({ suites: [] }), /Unregistered|No registered/)
assert.throws(() => validate({ suites: [manifest.suites[0], manifest.suites[0]] }), /Duplicate/)
assert.throws(() => validate({ suites: [{ id:'escape', file:'../app.js' }] }), /Invalid suite/)
const success = execute(process.execPath, ['-e', 'console.log("evidence")'])
assert.equal(success.status, 'passed')
assert(success.stdout.includes('evidence'))
const failed = execute(process.execPath, ['-e', 'console.error("broken");process.exit(3)'])
assert.equal(failed.status, 'failed')
assert.equal(failed.exitCode, 3)
assert(failed.stderr.includes('broken'))
const timed = execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs:100 })
assert.equal(timed.status, 'failed')
assert(timed.error.includes('ETIMEDOUT'))
const missing = execute('/nonexistent/majiang-test-runtime', [])
assert.equal(missing.status, 'failed')
assert(missing.error.includes('ENOENT'))
// Simulate a tab-bar source edit in memory; never touch runtime files or storage.
const originalRead = fs.readFileSync
const before = snapshot()
const tabSource = path.resolve(__dirname, '../../custom-tab-bar/index.js')
let after
try {
  fs.readFileSync = function (file, ...args) {
    const bytes = originalRead.call(this, file, ...args)
    return String(file) === tabSource ? Buffer.concat([bytes, Buffer.from('\n// changed')]) : bytes
  }
  after = snapshot()
} finally { fs.readFileSync = originalRead }
assert.notEqual(after, before, 'custom tab source edits must invalidate regression/watch fingerprints')
assert.equal(snapshot(), before)
console.log('Runner contract passed: registration, path isolation, success/failure evidence, timeout and missing runtime.')
