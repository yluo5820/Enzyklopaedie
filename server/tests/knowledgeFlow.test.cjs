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

  await t.test('knowledge item detail routes handle notes, tasks, and reviews', async () => {
    const createResponse = await request('/api/knowledge-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'article',
        title: 'Late Roman Statecraft',
        creator: 'Test Historian',
        status: 'active',
      }),
    });

    assert.equal(createResponse.status, 201);
    const createdItem = await createResponse.json();

    const noteResponse = await request(`/api/knowledge-items/${createdItem.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Track how administrative reforms changed over time.',
      }),
    });

    assert.equal(noteResponse.status, 201);
    const note = await noteResponse.json();
    assert.equal(note.knowledgeItemId, createdItem.id);

    const updatedNoteResponse = await request(
      `/api/knowledge-items/${createdItem.id}/notes/${note.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Track how administrative reforms changed across late antiquity.',
        }),
      }
    );

    assert.equal(updatedNoteResponse.status, 200);
    const updatedNote = await updatedNoteResponse.json();
    assert.match(updatedNote.content, /late antiquity/);

    const taskResponse = await request(`/api/knowledge-items/${createdItem.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Write summary outline',
        details: 'Draft a short encyclopedia entry from the notes.',
        dueAt: '2026-04-15',
      }),
    });

    assert.equal(taskResponse.status, 201);
    const task = await taskResponse.json();
    assert.equal(task.status, 'todo');
    assert.equal(task.dueAt, '2026-04-15');

    const completedTaskResponse = await request(
      `/api/knowledge-items/${createdItem.id}/tasks/${task.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
        }),
      }
    );

    assert.equal(completedTaskResponse.status, 200);
    const completedTask = await completedTaskResponse.json();
    assert.equal(completedTask.status, 'done');
    assert.ok(completedTask.completedAt);

    const reviewResponse = await request(`/api/knowledge-items/${createdItem.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: 4,
        summary: 'Strong synthesis',
        body: 'Useful framing, but it still needs a more explicit comparison section.',
      }),
    });

    assert.equal(reviewResponse.status, 201);
    const review = await reviewResponse.json();
    assert.equal(review.score, 4);

    const notesResponse = await request(`/api/knowledge-items/${createdItem.id}/notes`);
    const tasksResponse = await request(`/api/knowledge-items/${createdItem.id}/tasks`);
    const reviewsResponse = await request(`/api/knowledge-items/${createdItem.id}/reviews`);

    assert.equal(notesResponse.status, 200);
    assert.equal(tasksResponse.status, 200);
    assert.equal(reviewsResponse.status, 200);

    const notes = await notesResponse.json();
    const tasks = await tasksResponse.json();
    const reviews = await reviewsResponse.json();

    assert.equal(notes.length, 1);
    assert.equal(tasks.length, 1);
    assert.equal(reviews.length, 1);

    const activityResponse = await request('/api/activity-events?limit=20');
    assert.equal(activityResponse.status, 200);
    const activityEvents = await activityResponse.json();
    const detailEvents = activityEvents.filter(
      (event) => event.entityType === 'knowledge_item' && event.entityId === createdItem.id
    );

    assert.deepEqual(
      detailEvents.map((event) => event.type),
      ['review_created', 'task_completed', 'task_created', 'note_created', 'knowledge_item_created']
    );

    const deleteNoteResponse = await request(
      `/api/knowledge-items/${createdItem.id}/notes/${note.id}`,
      { method: 'DELETE' }
    );
    const deleteTaskResponse = await request(
      `/api/knowledge-items/${createdItem.id}/tasks/${task.id}`,
      { method: 'DELETE' }
    );
    const deleteReviewResponse = await request(
      `/api/knowledge-items/${createdItem.id}/reviews/${review.id}`,
      { method: 'DELETE' }
    );

    assert.equal(deleteNoteResponse.status, 204);
    assert.equal(deleteTaskResponse.status, 204);
    assert.equal(deleteReviewResponse.status, 204);
  });

  await t.test('taxonomy and relation routes classify and link knowledge items', async () => {
    const initialTopicsResponse = await request('/api/topics');
    assert.equal(initialTopicsResponse.status, 200);
    const initialTopics = await initialTopicsResponse.json();
    const ontologyTopic = initialTopics.find((topic) => topic.slug === 'ontology');
    assert.ok(ontologyTopic);
    assert.equal(ontologyTopic.parentTopicId, null);

    const sourceResponse = await request('/api/knowledge-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'book',
        title: 'The Mediterranean World',
        creator: 'Test Author',
      }),
    });
    const targetResponse = await request('/api/knowledge-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'essay',
        title: 'Imperial Administration Overview',
        creator: 'Related Author',
      }),
    });

    assert.equal(sourceResponse.status, 201);
    assert.equal(targetResponse.status, 201);

    const sourceItem = await sourceResponse.json();
    const targetItem = await targetResponse.json();

    const rootTopicResponse = await request('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'History',
      }),
    });

    assert.equal(rootTopicResponse.status, 201);
    const rootTopic = await rootTopicResponse.json();
    assert.equal(rootTopic.slug, 'history');
    assert.equal(rootTopic.parentTopicId, ontologyTopic.id);

    const childTopicResponse = await request('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Late Antiquity',
        parentTopicId: rootTopic.id,
        description: 'A child topic for taxonomy tests.',
      }),
    });

    assert.equal(childTopicResponse.status, 201);
    const childTopic = await childTopicResponse.json();
    assert.equal(childTopic.parentTopicId, rootTopic.id);
    assert.equal(childTopic.slug, 'late-antiquity');

    const topicsResponse = await request('/api/topics');
    assert.equal(topicsResponse.status, 200);
    const topics = await topicsResponse.json();
    assert.ok(topics.some((topic) => topic.id === rootTopic.id));
    assert.ok(topics.some((topic) => topic.id === childTopic.id));

    const assignTopicResponse = await request(`/api/knowledge-items/${sourceItem.id}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: childTopic.id,
      }),
    });

    assert.equal(assignTopicResponse.status, 201);

    const assignedTopicsResponse = await request(`/api/knowledge-items/${sourceItem.id}/topics`);
    assert.equal(assignedTopicsResponse.status, 200);
    const assignedTopics = await assignedTopicsResponse.json();
    assert.equal(assignedTopics.length, 1);
    assert.equal(assignedTopics[0].id, childTopic.id);

    const fetchedTopicResponse = await request(`/api/topics/${childTopic.id}`);
    assert.equal(fetchedTopicResponse.status, 200);
    const fetchedTopic = await fetchedTopicResponse.json();
    assert.equal(fetchedTopic.parentTopicId, rootTopic.id);
    assert.equal(fetchedTopic.knowledgeItemCount, 1);

    const topicKnowledgeItemsResponse = await request(`/api/topics/${childTopic.id}/knowledge-items`);
    assert.equal(topicKnowledgeItemsResponse.status, 200);
    const topicKnowledgeItems = await topicKnowledgeItemsResponse.json();
    assert.equal(topicKnowledgeItems.length, 1);
    assert.equal(topicKnowledgeItems[0].id, sourceItem.id);

    const relationResponse = await request(`/api/knowledge-items/${sourceItem.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityId: targetItem.id,
        relationType: 'references',
        note: 'The source item draws on this essay for context.',
      }),
    });

    assert.equal(relationResponse.status, 201);
    const relation = await relationResponse.json();
    assert.equal(relation.toEntityId, targetItem.id);
    assert.equal(relation.toEntityTitle, 'Imperial Administration Overview');

    const duplicateRelationResponse = await request(`/api/knowledge-items/${sourceItem.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityId: targetItem.id,
        relationType: 'references',
      }),
    });

    assert.equal(duplicateRelationResponse.status, 200);
    const duplicateRelation = await duplicateRelationResponse.json();
    assert.equal(duplicateRelation.id, relation.id);

    const referenceEntityResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'era',
        title: 'Late Antiquity',
        startYear: 250,
        endYear: 750,
      }),
    });

    assert.equal(referenceEntityResponse.status, 201);
    const eraEntity = await referenceEntityResponse.json();

    const entityRelationResponse = await request(`/api/knowledge-items/${sourceItem.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityType: 'reference_entity',
        toEntityId: eraEntity.id,
        relationType: 'during',
        note: 'The source item belongs to this historical period.',
      }),
    });

    assert.equal(entityRelationResponse.status, 201);
    const entityRelation = await entityRelationResponse.json();
    assert.equal(entityRelation.toEntityType, 'reference_entity');
    assert.equal(entityRelation.toEntityTitle, 'Late Antiquity');
    assert.equal(entityRelation.toEntityKind, 'era');

    const relationsResponse = await request(`/api/knowledge-items/${sourceItem.id}/relations`);
    assert.equal(relationsResponse.status, 200);
    const relations = await relationsResponse.json();
    assert.equal(relations.length, 2);
    assert.ok(relations.some((entry) => entry.toEntityKind === 'essay'));
    assert.ok(relations.some((entry) => entry.toEntityKind === 'era'));

    const topicRelationResponse = await request(`/api/topics/${childTopic.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityType: 'reference_entity',
        toEntityId: eraEntity.id,
        relationType: 'during',
        note: 'This topic sits inside the period.',
      }),
    });

    assert.equal(topicRelationResponse.status, 201);
    const topicRelation = await topicRelationResponse.json();
    assert.equal(topicRelation.toEntityTitle, 'Late Antiquity');
    assert.equal(topicRelation.toEntityKind, 'era');

    const topicRelationsResponse = await request(`/api/topics/${childTopic.id}/relations`);
    assert.equal(topicRelationsResponse.status, 200);
    const topicRelations = await topicRelationsResponse.json();
    assert.equal(topicRelations.length, 1);
    assert.equal(topicRelations[0].relationType, 'during');

    const activityResponse = await request('/api/activity-events?limit=40');
    assert.equal(activityResponse.status, 200);
    const activityEvents = await activityResponse.json();

    assert.ok(
      activityEvents.some(
        (event) => event.type === 'topic_created' && event.entityType === 'topic' && event.entityId === rootTopic.id
      )
    );
    assert.ok(
      activityEvents.some(
        (event) =>
          event.type === 'relation_created' &&
          event.entityType === 'knowledge_item' &&
          event.entityId === sourceItem.id
      )
    );
    assert.ok(
      activityEvents.some(
        (event) =>
          event.type === 'relation_created' &&
          event.entityType === 'topic' &&
          event.entityId === childTopic.id
      )
    );

    const deleteRelationResponse = await request(
      `/api/knowledge-items/${sourceItem.id}/relations/${relation.id}`,
      { method: 'DELETE' }
    );
    const deleteEntityRelationResponse = await request(
      `/api/knowledge-items/${sourceItem.id}/relations/${entityRelation.id}`,
      { method: 'DELETE' }
    );
    const deleteTopicRelationResponse = await request(
      `/api/topics/${childTopic.id}/relations/${topicRelation.id}`,
      { method: 'DELETE' }
    );
    const removeTopicResponse = await request(
      `/api/knowledge-items/${sourceItem.id}/topics/${childTopic.id}`,
      { method: 'DELETE' }
    );

    assert.equal(deleteRelationResponse.status, 204);
    assert.equal(deleteEntityRelationResponse.status, 204);
    assert.equal(deleteTopicRelationResponse.status, 204);
    assert.equal(removeTopicResponse.status, 204);
  });

  await t.test('reference entity routes support the unified atlas workflow', async () => {
    const initialPeopleResponse = await request('/api/reference-entities?kind=person');
    assert.equal(initialPeopleResponse.status, 200);

    const initialPeople = await initialPeopleResponse.json();
    const unknownAuthor = initialPeople.find((entity) => entity.title === 'Unknown Author');
    assert.ok(unknownAuthor);
    assert.equal(unknownAuthor.kind, 'person');
    assert.equal(unknownAuthor.metadata.legacySource, 'authors');

    const createResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'nation',
        title: 'Byzantine Empire',
        summary: 'A test fixture for the reference atlas.',
        startYear: 330,
        endYear: 1453,
        metadata: {
          origin: 'server-test',
        },
      }),
    });

    assert.equal(createResponse.status, 201);
    const createdEntity = await createResponse.json();
    assert.equal(createdEntity.kind, 'nation');
    assert.equal(createdEntity.slug, 'nation-byzantine-empire');
    assert.deepEqual(createdEntity.metadata, {
      origin: 'server-test',
    });

    const duplicateResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'nation',
        title: 'Byzantine Empire',
      }),
    });

    assert.equal(duplicateResponse.status, 200);
    const duplicateEntity = await duplicateResponse.json();
    assert.equal(duplicateEntity.id, createdEntity.id);

    const nationsResponse = await request('/api/reference-entities?kind=nation');
    assert.equal(nationsResponse.status, 200);
    const nations = await nationsResponse.json();
    assert.ok(nations.some((entity) => entity.id === createdEntity.id));

    const getResponse = await request(`/api/reference-entities/${createdEntity.id}`);
    assert.equal(getResponse.status, 200);
    const fetchedEntity = await getResponse.json();
    assert.equal(fetchedEntity.title, 'Byzantine Empire');
    assert.equal(fetchedEntity.endYear, 1453);

    const updateResponse = await request(`/api/reference-entities/${createdEntity.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'civilization',
        title: 'Eastern Roman Empire',
        summary: 'Updated during the server test pass.',
        endYear: 1453,
      }),
    });

    assert.equal(updateResponse.status, 200);
    const updatedEntity = await updateResponse.json();
    assert.equal(updatedEntity.kind, 'civilization');
    assert.equal(updatedEntity.title, 'Eastern Roman Empire');
    assert.equal(updatedEntity.slug, 'civilization-eastern-roman-empire');
    assert.equal(updatedEntity.startYear, 330);

    const activityResponse = await request('/api/activity-events?limit=50');
    assert.equal(activityResponse.status, 200);
    const activityEvents = await activityResponse.json();
    const entityEvents = activityEvents.filter(
      (event) =>
        event.entityType === 'reference_entity' &&
        event.entityId === createdEntity.id
    );

    assert.equal(entityEvents.length, 2);
    assert.equal(entityEvents[0].type, 'reference_entity_updated');
    assert.equal(entityEvents[1].type, 'reference_entity_created');

    const deleteResponse = await request(`/api/reference-entities/${createdEntity.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 204);

    const missingResponse = await request(`/api/reference-entities/${createdEntity.id}`);
    assert.equal(missingResponse.status, 404);
  });
});
