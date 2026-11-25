import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSubmitEnter } from './keyboard.ts'

test('Enter commits when the IME is not composing', () => {
  assert.equal(isSubmitEnter({ key: 'Enter', nativeEvent: { isComposing: false } }), true)
})

test('Enter during IME composition does not commit', () => {
  assert.equal(isSubmitEnter({ key: 'Enter', nativeEvent: { isComposing: true } }), false)
})

test('non Enter keys do not commit', () => {
  assert.equal(isSubmitEnter({ key: 'Tab', nativeEvent: { isComposing: false } }), false)
})

test('Enter with keyCode 229 does not commit', () => {
  assert.equal(
    isSubmitEnter({ key: 'Enter', nativeEvent: { isComposing: false, keyCode: 229 } }),
    false,
  )
})

test('bare shortcuts respond only without modifiers, typing or overlays', async () => {
  const { isBareShortcut } = await import('./keyboard.ts')
  const base = { key: 'n', metaKey: false, ctrlKey: false, altKey: false, target: { tagName: 'BODY' } }
  assert.equal(isBareShortcut(base, false), true)
  assert.equal(isBareShortcut({ ...base, metaKey: true }, false), false)
  assert.equal(isBareShortcut({ ...base, target: { tagName: 'INPUT' } }, false), false)
  assert.equal(isBareShortcut({ ...base, target: { tagName: 'DIV', isContentEditable: true } }, false), false)
  assert.equal(isBareShortcut({ ...base, isComposing: true }, false), false)
  assert.equal(isBareShortcut(base, true), false)
})

test('正在关闭的浮层（data-state="closed"）不算打开', async () => {
  const { overlayIsOpen, OPEN_OVERLAY_SELECTOR } = await import('./keyboard.ts')
  const seen: string[] = []
  assert.equal(overlayIsOpen({ querySelector: (s: string) => (seen.push(s), null) }), false)
  assert.equal(seen[0], OPEN_OVERLAY_SELECTOR)
  for (const role of ['dialog', 'menu', 'alertdialog']) {
    assert.ok(OPEN_OVERLAY_SELECTOR.includes(`[role="${role}"]:not([data-state="closed"])`))
  }
})
