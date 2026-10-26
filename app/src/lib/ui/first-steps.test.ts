import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstSteps, showFirstSteps } from './first-steps';

const base = { connected: false, anyEntered: false, held: false, hasLeverage: false, readOnly: false };

test('a new visitor starts at connect and every later step is open', () => {
  const steps = firstSteps(base);
  assert.deepEqual(steps.map(s => s.key), ['connect', 'enable', 'supply', 'next']);
  assert.deepEqual(steps.map(s => s.done), [false, false, false, false]);
  assert.deepEqual(steps.map(s => s.current), [true, false, false, false]);
});

test('the current marker follows progress', () => {
  assert.equal(firstSteps({ ...base, connected: true }).find(s => s.current)?.key, 'enable');
  assert.equal(firstSteps({ ...base, connected: true, anyEntered: true }).find(s => s.current)?.key, 'supply');
  const done = firstSteps({ ...base, connected: true, anyEntered: true, held: true });
  assert.equal(done.find(s => s.current)?.key, 'next');
  assert.deepEqual(done.map(s => s.done), [true, true, true, false]);
});

test('leverage groups and read-only previews change the copy only', () => {
  assert.match(firstSteps({ ...base, hasLeverage: true })[3].title, /leveraged position/);
  assert.match(firstSteps({ ...base, readOnly: true })[0].detail, /read-only/);
  assert.equal(firstSteps({ ...base, hasLeverage: true }).length, 4);
});

test('the checklist hides once the wallet holds a balance in the group', () => {
  assert.equal(showFirstSteps({ held: false }), true);
  assert.equal(showFirstSteps({ held: true }), false);
});
