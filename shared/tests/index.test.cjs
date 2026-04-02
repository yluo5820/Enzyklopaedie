const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeKnowledgeProgress, slugifyName } = require('../dist/index.js');

test('summarizeKnowledgeProgress counts total, active, and completed items', () => {
  const summary = summarizeKnowledgeProgress([
    { status: 'inbox' },
    { status: 'active' },
    { status: 'active' },
    { status: 'completed' },
    { status: 'archived' },
  ]);

  assert.equal(summary.total, 5);
  assert.equal(summary.active, 2);
  assert.equal(summary.completed, 1);
  assert.deepEqual(summary.byStatus, {
    inbox: 1,
    queued: 0,
    active: 2,
    completed: 1,
    archived: 1,
  });
});

test('slugifyName normalizes labels into stable slugs', () => {
  assert.equal(slugifyName('  Ancient Philosophy & Ethics  '), 'ancient-philosophy-ethics');
  assert.equal(slugifyName('World History'), 'world-history');
  assert.equal(slugifyName('Multiple   Spaces'), 'multiple-spaces');
});
