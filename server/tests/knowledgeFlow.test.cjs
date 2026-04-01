const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

let baseUrl = '';
let closeDb;
let server;
let tempDir;

const request = (pathname, options) => fetch(`${baseUrl}${pathname}`, options);

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enzyklopaedie-server-test-'));
  process.env.DB_PATH = path.join(tempDir, 'knowledge-flow.db');

  const dbModule = require('../dist/db');
  const app = require('../dist/app').default;

  closeDb = dbModule.closeDb;
  await dbModule.initializeDatabase();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to read test server address.');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  if (closeDb) {
    await closeDb();
  }

  delete process.env.DB_PATH;

  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('knowledge item routes support the current Phase 1 workflow', async (t) => {
  let firstItemId;

  await t.test('POST and GET /api/knowledge-items persist metadata and default status', async () => {
    const createResponse = await request('/api/knowledge-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'book',
        title: 'The Structure of Scientific Revolutions',
        creator: 'Thomas S. Kuhn',
        summary: 'A test fixture for the knowledge foundation.',
        metadata: {
          source: 'manual-test',
          tags: ['history-of-science', 'philosophy'],
        },
      }),
    });

    assert.equal(createResponse.status, 201);

    const createdItem = await createResponse.json();
    firstItemId = createdItem.id;

    assert.equal(createdItem.kind, 'book');
    assert.equal(createdItem.title, 'The Structure of Scientific Revolutions');
    assert.equal(createdItem.status, 'inbox');
    assert.deepEqual(createdItem.metadata, {
      source: 'manual-test',
      tags: ['history-of-science', 'philosophy'],
    });
    assert.ok(createdItem.createdAt);
    assert.ok(createdItem.updatedAt);

    const listResponse = await request('/api/knowledge-items');
    assert.equal(listResponse.status, 200);

    const items = await listResponse.json();
    const listedItem = items.find((item) => item.id === firstItemId);

    assert.ok(listedItem);
    assert.deepEqual(listedItem.metadata, {
      source: 'manual-test',
      tags: ['history-of-science', 'philosophy'],
    });

    const getResponse = await request(`/api/knowledge-items/${firstItemId}`);
    assert.equal(getResponse.status, 200);

    const fetchedItem = await getResponse.json();
    assert.equal(fetchedItem.id, firstItemId);
    assert.equal(fetchedItem.creator, 'Thomas S. Kuhn');
  });

  await t.test('PUT /api/knowledge-items/:id updates items and records recent activity', async () => {
    const createResponse = await request('/api/knowledge-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'lecture',
        title: 'Roman Engineering Survey',
        creator: 'Test Speaker',
        status: 'active',
      }),
    });

    assert.equal(createResponse.status, 201);
    const createdItem = await createResponse.json();

    await new Promise((resolve) => setTimeout(resolve, 20));

    const updateResponse = await request(`/api/knowledge-items/${createdItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        summary: 'Completed during the API test pass.',
        metadata: {
          completionSource: 'server-test',
        },
      }),
    });

    assert.equal(updateResponse.status, 200);

    const updatedItem = await updateResponse.json();
    assert.equal(updatedItem.status, 'completed');
    assert.equal(updatedItem.summary, 'Completed during the API test pass.');
    assert.deepEqual(updatedItem.metadata, {
      completionSource: 'server-test',
    });

    const activityResponse = await request('/api/activity-events?limit=10');
    assert.equal(activityResponse.status, 200);

    const events = await activityResponse.json();
    const relevantEvents = events.filter(
      (event) => event.entityType === 'knowledge_item' && event.entityId === createdItem.id
    );

    assert.equal(relevantEvents.length, 2);
    assert.equal(relevantEvents[0].type, 'knowledge_item_updated');
    assert.equal(relevantEvents[1].type, 'knowledge_item_created');

    const limitedActivityResponse = await request('/api/activity-events?limit=1');
    assert.equal(limitedActivityResponse.status, 200);

    const limitedEvents = await limitedActivityResponse.json();
    assert.equal(limitedEvents.length, 1);
    assert.equal(limitedEvents[0].entityId, createdItem.id);
  });

  await t.test('PUT /api/knowledge-items/:id rejects an empty payload', async () => {
    const response = await request(`/api/knowledge-items/${firstItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: 'No fields to update' });
  });
});
