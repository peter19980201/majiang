// Poll fingerprints so atomic editor saves and nested directory changes are detected.
const { spawn } = require('node:child_process')
const path = require('node:path')
const { snapshot } = require('./harness/runner')
let fingerprint = snapshot(), pending = true, child = null, stopping = false
let lastChange = 0
const timer = setInterval(() => {
  let current
  try { current = snapshot() } catch (error) { console.error(error.message); return }
  if (current !== fingerprint) { fingerprint = current; pending = true; lastChange = Date.now() }
  if (!stopping && !child && pending && Date.now() - lastChange >= 500) {
    pending = false
    child = spawn(process.execPath, [path.join(__dirname,'run.js')], { stdio:'inherit' })
    child.on('error', error => console.error(error.message))
    child.on('close', () => { child = null })
  }
}, 1000)
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  stopping = true; clearInterval(timer)
  if (child) child.kill(signal)
})
console.log('Watching source, assets and test module. Changes trigger the full Node regression. Ctrl+C to stop.')
