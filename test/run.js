#!/usr/bin/env node
try {
  process.exitCode = require('./harness/runner').main()
} catch (error) {
  console.error(error.stack)
  process.exitCode = 1
}
