import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOGO_SVG, LOGO_URL } from './logo.ts'

const here = dirname(fileURLToPath(import.meta.url))

test('页面里的图标与网页版标签页图标 public/logo-mark.svg 一致', () => {
  const file = readFileSync(join(here, '..', '..', 'public', 'logo-mark.svg'), 'utf8')
  assert.equal(LOGO_SVG.trim(), file.trim())
})

test('图标 data URI 可以还原出原始 SVG', () => {
  assert.ok(LOGO_URL.startsWith('data:image/svg+xml,'))
  assert.equal(decodeURIComponent(LOGO_URL.slice('data:image/svg+xml,'.length)), LOGO_SVG)
})
