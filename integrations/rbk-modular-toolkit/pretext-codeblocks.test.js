import test from 'node:test';
import assert from 'node:assert/strict';
import { Text } from '@codemirror/state';
import { findFencedBlocks, canvasWidthWithTabs } from './pretext-codeblocks/measure.js';
const doc = text => Text.of(text.split('\n'));
test('recognizes complete fences and preserves spaces and tabs', () => {
  const blocks = findFencedBlocks(doc('intro\n```js\n  one\n\ttwo\n```\n~~~\nx\n~~~'));
  assert.deepEqual(blocks.map(x => [x.fromLine,x.toLine,x.text]), [[2,5,'  one\n\ttwo'],[6,8,'x']]);
});
test('unclosed, oversize and invalid fences fall back', () => {
  assert.equal(findFencedBlocks(doc('```js\nx')).length, 0);
  assert.equal(findFencedBlocks(doc('```\nx\n```'), {maxBlock:1}).length, 0);
  assert.equal(findFencedBlocks(doc('```\nx\n```'), {maxDocument:2}).length, 0);
  assert.equal(findFencedBlocks(doc('```js`bad\nx\n```')).length, 0);
});
test('a mismatched or short closer stays in the block', () => {
  let b=findFencedBlocks(doc('````js\n```\n~~~\n````'));
  assert.equal(b.length,1);assert.equal(b[0].text,'```\n~~~');
});
test('canvas fallback uses actual tab stops and longest line', () => {
  const ctx={measureText: s=>({width:s.length * 5})};
  assert.equal(canvasWidthWithTabs('x\ty\nxxxxx',ctx,2),25);
  assert.equal(canvasWidthWithTabs('x\ty',ctx,2),15);
  assert.equal(canvasWidthWithTabs('\t',ctx,4),20);
});

