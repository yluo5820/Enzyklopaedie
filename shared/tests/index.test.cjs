const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeKnowledgeProgress, slugifyTopicName } = require('../dist/index.js');

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

test('slugifyTopicName normalizes topic labels into stable slugs', () => {
  assert.equal(slugifyTopicName('  Ancient Philosophy & Ethics  '), 'ancient-philosophy-ethics');
  assert.equal(slugifyTopicName('World History'), 'world-history');
  assert.equal(slugifyTopicName('Multiple   Spaces'), 'multiple-spaces');
});
