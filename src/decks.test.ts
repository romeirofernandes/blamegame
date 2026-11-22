import { expect, test } from 'bun:test';
import { cycleDeckIndex } from './decks';

test('prompt navigation wraps in either direction', () => {
  expect(cycleDeckIndex(4, 1, 5)).toBe(0);
  expect(cycleDeckIndex(0, -1, 5)).toBe(4);
  expect(cycleDeckIndex(2, -7, 5)).toBe(0);
  expect(cycleDeckIndex(0, 1, 0)).toBe(0);
});
