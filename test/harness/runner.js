const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const project = path.dirname(root)

function execute(command, args, options = {}) {
  const started = Date.now()
  const result = spawnSync(command, args, {
    cwd: project, encoding: 'utf8', timeout: options.timeoutMs || 60000,
    maxBuffer: 32 * 1024 * 1024, ...options
  })
  return { status: result.status === 0 && !result.error && !result.signal ? 'passed' : 'failed',
    exitCode: result.status, signal: result.signal, durationMs: Date.now() - started,
    error: result.error ? result.error.message : null,
    stdout: result.stdout || '', stderr: result.stderr || '' }
}

function validate(manifest) {
  const ids = new Set()
  const files = new Set()
  for (const suite of manifest.suites) {
    if (!suite.id || ids.has(suite.id)) throw new Error(`Duplicate/missing suite id: ${suite.id}`)
    ids.add(suite.id)
    const file = path.resolve(root, suite.file)
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) throw new Error(`Invalid suite: ${suite.file}`)
    if (files.has(suite.file)) throw new Error(`Duplicate suite file: ${suite.file}`)
    files.add(suite.file)
  }
  for (const file of fs.readdirSync(path.join(root, 'suites')).filter(f => f.endsWith('.js'))) {
    if (!files.has('suites/' + file)) throw new Error(`Unregistered suite: ${file}`)
  }
  if (!ids.size) throw new Error('No registered suites')
}

function snapshot() {
  const hash = createHash('sha256')
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      if (['.git', 'node_modules', '__pycache__', 'reports'].includes(entry.name)) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile()) {
        hash.update(path.relative(project, file)); hash.update(fs.readFileSync(file))
      }
    }
  }
  for (const dir of ['pages', 'components', 'utils', 'styles', 'assets', 'test']) walk(path.join(project, dir))
  for (const file of ['app.js', 'app.json', 'app.wxss', 'project.config.json']) {
    hash.update(file); hash.update(fs.readFileSync(path.join(project, file)))
  }
  return hash.digest('hex')
}

function main(args = process.argv.slice(2)) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  validate(manifest)
  const allowed = ['--list', '--oracle']
  for (const arg of args) if (!allowed.includes(arg) && !/^--(suite|group|python)=.+$/.test(arg)) {
    throw new Error(`Unknown argument: ${arg}`)
  }
  const value = key => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3)
  if (args.includes('--list')) {
    for (const suite of manifest.suites) console.log(`${suite.id}\t${suite.group}\t${suite.features.join(',')}`)
    console.log('oracle\toptional Python independent verification')
    return 0
  }
  const selected = manifest.suites.filter(s => (!value('suite') || s.id === value('suite')) &&
    (!value('group') || s.group === value('group')))
  if (!selected.length) throw new Error('No suites match the selection')
  const startedAt = new Date().toISOString()
  const runId = startedAt.replace(/[:.]/g, '-') + '-' + process.pid
  const dir = path.join(root, 'reports', runId)
  fs.mkdirSync(dir, { recursive: true })
  const before = snapshot()
  const results = []
  const commands = selected.map(s => ({ ...s, command: process.execPath, args: [path.join(root,s.file)] }))
  if (args.includes('--oracle')) commands.push({ id:'oracle', group:'oracle', features:['F04','F05'],
    command:value('python') || process.env.MAJIANG_TEST_PYTHON || 'python3',
    args:[path.join(root,'winning-hands-oracle.py')], timeoutMs:120000 })
  for (const suite of commands) {
    const result = { id: suite.id, group: suite.group, features: suite.features,
      ...execute(suite.command, suite.args, { timeoutMs:suite.timeoutMs }) }
    fs.writeFileSync(path.join(dir, suite.id + '.log'), result.stdout + result.stderr + (result.error || ''))
    results.push(result)
    console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${suite.id} (${result.durationMs}ms)`)
    if (result.status !== 'passed') console.error((result.stderr || result.error || result.stdout).slice(-4000))
  }
  const after = snapshot()
  const summary = { runId, startedAt, node:process.version,
    platform:process.platform, sourceHash:before, sourceUnchanged:before === after,
    selected: { suite:value('suite') || null, group:value('group') || null },
    total:results.length, passed:results.filter(r => r.status === 'passed').length,
    optionalOracle:args.includes('--oracle') ? 'executed' : 'not-run',
    scope:'Node suites and platform mocks; no real WeChat UI/device verification', results }
  summary.failed = summary.total - summary.passed
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(summary,null,2) + '\n')
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const html = `<!doctype html><meta charset="utf-8"><title>麻将测试报告</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}pre{white-space:pre-wrap}</style><h1>自动化测试 ${summary.passed}/${summary.total} 通过</h1><p>${escape(runId)}</p><p>${escape(summary.scope)}</p><p>测试期间源码未变更：${summary.sourceUnchanged}；Python oracle：${summary.optionalOracle}</p><table><tr><th>套件</th><th>分组</th><th>结果</th><th>耗时</th></tr>${results.map(r => `<tr><td><a href="${escape(r.id)}.log">${escape(r.id)}</a></td><td>${escape(r.group)}</td><td>${r.status}</td><td>${r.durationMs}ms</td></tr>`).join('')}</table>`
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  fs.writeFileSync(path.join(root,'reports','latest.json'), JSON.stringify({runId, report:path.relative(root,path.join(dir,'index.html')), passed:summary.passed,failed:summary.failed,sourceUnchanged:summary.sourceUnchanged},null,2)+'\n')
  console.log(`\n${summary.passed}/${summary.total} suites passed. Report: ${path.join(dir,'index.html')}`)
  if (!summary.sourceUnchanged) console.error('Source changed during this run; rerun on a stable workspace.')
  return summary.failed || !summary.sourceUnchanged ? 1 : 0
}
module.exports = { main, execute, validate, snapshot }
