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
