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

const requestThroughHttp = (pathname, options = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            json: () => Promise.resolve(body ? JSON.parse(body) : null),
          });
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });

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
        kind: 'book',
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
    const initialTopicsResponse = await request('/api/subjects');
    assert.equal(initialTopicsResponse.status, 200);
    const initialTopics = await initialTopicsResponse.json();
    const ontologyTopic = initialTopics.find((topic) => topic.slug === 'ontology');
    assert.ok(ontologyTopic);
    assert.equal(ontologyTopic.parentSubjectId, null);

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
        kind: 'book',
        title: 'Imperial Administration Overview',
        creator: 'Related Author',
      }),
    });

    assert.equal(sourceResponse.status, 201);
    assert.equal(targetResponse.status, 201);

    const sourceItem = await sourceResponse.json();
    const targetItem = await targetResponse.json();

    const rootTopicResponse = await request('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'History',
      }),
    });

    assert.equal(rootTopicResponse.status, 201);
    const rootSubject = await rootTopicResponse.json();
    assert.equal(rootSubject.slug, 'history');
    assert.equal(rootSubject.parentSubjectId, ontologyTopic.id);

    const childTopicResponse = await request('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Late Antiquity',
        parentSubjectId: rootSubject.id,
        description: 'A child topic for taxonomy tests.',
      }),
    });

    assert.equal(childTopicResponse.status, 201);
    const childSubject = await childTopicResponse.json();
    assert.equal(childSubject.parentSubjectId, rootSubject.id);
    assert.equal(childSubject.slug, 'late-antiquity');

    const removableChildSubjectResponse = await request('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Temporary Branch',
        parentSubjectId: rootSubject.id,
      }),
    });

    assert.equal(removableChildSubjectResponse.status, 201);
    const removableChildSubject = await removableChildSubjectResponse.json();

    const studyTopicResponse = await request('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: childSubject.id,
        name: 'Late Antiquity in the Mediterranean',
        description: 'A contextual topic beneath the Late Antiquity subject.',
      }),
    });

    assert.equal(studyTopicResponse.status, 201);
    const studyTopic = await studyTopicResponse.json();
    assert.equal(studyTopic.subjectId, childSubject.id);
    assert.equal(studyTopic.subjectName, 'Late Antiquity');

    const removableStudyTopicResponse = await request('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: childSubject.id,
        name: 'Temporary Topic',
      }),
    });

    assert.equal(removableStudyTopicResponse.status, 201);
    const removableStudyTopic = await removableStudyTopicResponse.json();

    const topicsResponse = await request('/api/subjects');
    assert.equal(topicsResponse.status, 200);
    const topics = await topicsResponse.json();
    assert.ok(topics.some((topic) => topic.id === rootSubject.id));
    assert.ok(topics.some((topic) => topic.id === childSubject.id));

    const assignTopicResponse = await request(`/api/knowledge-items/${sourceItem.id}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: studyTopic.id,
      }),
    });

    assert.equal(assignTopicResponse.status, 201);

    const assignedTopicsResponse = await request(`/api/knowledge-items/${sourceItem.id}/topics`);
    assert.equal(assignedTopicsResponse.status, 200);
    const assignedTopics = await assignedTopicsResponse.json();
    assert.equal(assignedTopics.length, 1);
    assert.equal(assignedTopics[0].id, studyTopic.id);

    const fetchedStudyTopicResponse = await request(`/api/topics/${studyTopic.id}`);
    assert.equal(fetchedStudyTopicResponse.status, 200);
    const fetchedStudyTopic = await fetchedStudyTopicResponse.json();
    assert.equal(fetchedStudyTopic.subjectId, childSubject.id);
    assert.equal(fetchedStudyTopic.itemCount, 1);

    const topicKnowledgeItemsResponse = await request(`/api/topics/${studyTopic.id}/knowledge-items`);
    assert.equal(topicKnowledgeItemsResponse.status, 200);
    const topicKnowledgeItems = await topicKnowledgeItemsResponse.json();
    assert.equal(topicKnowledgeItems.length, 1);
    assert.equal(topicKnowledgeItems[0].id, sourceItem.id);

    const fetchedSubjectResponse = await request(`/api/subjects/${childSubject.id}`);
    assert.equal(fetchedSubjectResponse.status, 200);
    const fetchedSubject = await fetchedSubjectResponse.json();
    assert.equal(fetchedSubject.parentSubjectId, rootSubject.id);
    assert.equal(fetchedSubject.knowledgeItemCount, 1);
    assert.equal(fetchedSubject.topicCount, 2);

    const subjectKnowledgeItemsResponse = await request(`/api/subjects/${childSubject.id}/knowledge-items`);
    assert.equal(subjectKnowledgeItemsResponse.status, 200);
    const subjectKnowledgeItems = await subjectKnowledgeItemsResponse.json();
    assert.equal(subjectKnowledgeItems.length, 1);
    assert.equal(subjectKnowledgeItems[0].id, sourceItem.id);

    const deleteOccupiedStudyTopicResponse = await request(`/api/topics/${studyTopic.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteOccupiedStudyTopicResponse.status, 409);

    const deleteRemovableStudyTopicResponse = await request(`/api/topics/${removableStudyTopic.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRemovableStudyTopicResponse.status, 204);

    const studyTopicsAfterDeleteResponse = await request(`/api/topics?subjectId=${childSubject.id}`);
    assert.equal(studyTopicsAfterDeleteResponse.status, 200);
    const studyTopicsAfterDelete = await studyTopicsAfterDeleteResponse.json();
    assert.ok(!studyTopicsAfterDelete.some((topic) => topic.id === removableStudyTopic.id));

    const deleteOccupiedSubjectResponse = await request(`/api/subjects/${childSubject.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteOccupiedSubjectResponse.status, 409);

    const deleteRemovableChildSubjectResponse = await request(`/api/subjects/${removableChildSubject.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRemovableChildSubjectResponse.status, 204);

    const topicsAfterDeleteResponse = await request('/api/subjects');
    assert.equal(topicsAfterDeleteResponse.status, 200);
    const topicsAfterDelete = await topicsAfterDeleteResponse.json();
    assert.ok(!topicsAfterDelete.some((topic) => topic.id === removableChildSubject.id));

    const relationResponse = await request(`/api/knowledge-items/${sourceItem.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityId: targetItem.id,
        relationType: 'references',
        note: 'The source item draws on this written work for context.',
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
    assert.ok(relations.some((entry) => entry.toEntityKind === 'book'));
    assert.ok(relations.some((entry) => entry.toEntityKind === 'era'));

    const studyTopicRelationResponse = await request(`/api/topics/${studyTopic.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityType: 'reference_entity',
        toEntityId: eraEntity.id,
        relationType: 'about',
        note: 'This study topic is explicitly about the period.',
      }),
    });

    assert.equal(studyTopicRelationResponse.status, 201);
    const studyTopicRelation = await studyTopicRelationResponse.json();
    assert.equal(studyTopicRelation.toEntityTitle, 'Late Antiquity');
    assert.equal(studyTopicRelation.toEntityKind, 'era');

    const studyTopicRelationsResponse = await request(`/api/topics/${studyTopic.id}/relations`);
    assert.equal(studyTopicRelationsResponse.status, 200);
    const studyTopicRelations = await studyTopicRelationsResponse.json();
    assert.equal(studyTopicRelations.length, 1);
    assert.equal(studyTopicRelations[0].relationType, 'about');

    const invalidKnowledgeRelationResponse = await request(`/api/knowledge-items/${sourceItem.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityType: 'reference_entity',
        toEntityId: eraEntity.id,
        relationType: 'created_by',
      }),
    });

    assert.equal(invalidKnowledgeRelationResponse.status, 400);
    assert.match(
      (await invalidKnowledgeRelationResponse.json()).message,
      /not allowed from book item to era/
    );

    const invalidStudyTopicRelationResponse = await request(`/api/topics/${studyTopic.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityType: 'reference_entity',
        toEntityId: eraEntity.id,
        relationType: 'created_by',
      }),
    });

    assert.equal(invalidStudyTopicRelationResponse.status, 400);
    assert.match(
      (await invalidStudyTopicRelationResponse.json()).message,
      /not allowed from topic to era/
    );

    const personEntityResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'person',
        title: 'Ammianus Marcellinus',
      }),
    });

    assert.equal(personEntityResponse.status, 201);
    const personEntity = await personEntityResponse.json();

    const invalidReferenceRelationResponse = await request(
      `/api/reference-entities/${personEntity.id}/outgoing-relations`,
      {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityId: eraEntity.id,
        relationType: 'contains',
      }),
      }
    );

    assert.equal(invalidReferenceRelationResponse.status, 400);
    assert.match(
      (await invalidReferenceRelationResponse.json()).message,
      /not allowed from person to era/
    );

    const referenceEntityRelationsResponse = await request(`/api/reference-entities/${eraEntity.id}/relations`);
    assert.equal(referenceEntityRelationsResponse.status, 200);
    const referenceEntityRelations = await referenceEntityRelationsResponse.json();
    assert.equal(referenceEntityRelations.length, 2);
    assert.ok(referenceEntityRelations.some((entry) => entry.fromEntityType === 'knowledge_item'));
    assert.ok(referenceEntityRelations.some((entry) => entry.fromEntityType === 'topic'));

    const activityResponse = await request('/api/activity-events?limit=40');
    assert.equal(activityResponse.status, 200);
    const activityEvents = await activityResponse.json();

    assert.ok(
      activityEvents.some(
        (event) =>
          event.type === 'subject_created' &&
          event.entityType === 'subject' &&
          event.entityId === rootSubject.id
      )
    );
    assert.ok(
      activityEvents.some(
        (event) =>
          event.type === 'topic_created' &&
          event.entityType === 'topic' &&
          event.entityId === studyTopic.id
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
          event.entityId === studyTopic.id
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
    const deleteStudyTopicRelationResponse = await request(
      `/api/topics/${studyTopic.id}/relations/${studyTopicRelation.id}`,
      { method: 'DELETE' }
    );
    const removeTopicResponse = await request(
      `/api/knowledge-items/${sourceItem.id}/topics/${studyTopic.id}`,
      { method: 'DELETE' }
    );

    assert.equal(deleteRelationResponse.status, 204);
    assert.equal(deleteEntityRelationResponse.status, 204);
    assert.equal(deleteStudyTopicRelationResponse.status, 204);
    assert.equal(removeTopicResponse.status, 204);
  });

  await t.test('subject routes support tree editing guards', async () => {
    const topicsResponse = await request('/api/subjects');
    assert.equal(topicsResponse.status, 200);
    const topics = await topicsResponse.json();
    const ontologyTopic = topics.find((topic) => topic.slug === 'ontology');
    assert.ok(ontologyTopic);

    const branchResponse = await request('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Logic',
        parentSubjectId: ontologyTopic.id,
      }),
    });

    assert.equal(branchResponse.status, 201);
    const branch = await branchResponse.json();

    const childResponse = await request('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Modal Logic',
        parentSubjectId: branch.id,
      }),
    });

    assert.equal(childResponse.status, 201);
    const child = await childResponse.json();

    const renameResponse = await request(`/api/subjects/${branch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Formal systems and inference.',
        name: 'Formal Logic',
      }),
    });

    assert.equal(renameResponse.status, 200);
    const renamedBranch = await renameResponse.json();
    assert.equal(renamedBranch.name, 'Formal Logic');
    assert.equal(renamedBranch.slug, 'formal-logic');
    assert.equal(renamedBranch.description, 'Formal systems and inference.');

    const guardedDeleteResponse = await request(`/api/subjects/${branch.id}`, {
      method: 'DELETE',
    });

    assert.equal(guardedDeleteResponse.status, 409);
    assert.match(
      (await guardedDeleteResponse.json()).message,
      /Remove child subjects before deleting this branch/
    );

    const deleteChildResponse = await request(`/api/subjects/${child.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteChildResponse.status, 204);

    const deleteBranchResponse = await request(`/api/subjects/${branch.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteBranchResponse.status, 204);

    const rootRenameResponse = await request(`/api/subjects/${ontologyTopic.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Metaphysics',
      }),
    });

    assert.equal(rootRenameResponse.status, 400);
    assert.match(
      (await rootRenameResponse.json()).message,
      /Ontology must remain the root subject/
    );
  });

  await t.test('reference entity routes support the unified atlas workflow', async () => {
    const initialPeopleResponse = await request('/api/reference-entities?kind=person');
    assert.equal(initialPeopleResponse.status, 200);

    const initialPeople = await initialPeopleResponse.json();
    const unknownAuthor = initialPeople.find((entity) => entity.title === 'Unknown Author');
    assert.ok(unknownAuthor);
    assert.equal(unknownAuthor.kind, 'person');
    assert.equal(unknownAuthor.slug, 'person-unknown-author');
    assert.match(unknownAuthor.summary, /fallback person record/i);

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

    const eraResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'era',
        title: 'Middle Byzantine Period',
        startYear: 843,
        endYear: 1204,
      }),
    });
    assert.equal(eraResponse.status, 201);
    const eraEntity = await eraResponse.json();

    const nationResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'nation',
        title: 'Anatolian Theme',
        startYear: 669,
        endYear: 1077,
      }),
    });
    assert.equal(nationResponse.status, 201);
    const nationEntity = await nationResponse.json();

    const personResponse = await request('/api/reference-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'person',
        title: 'Michael Psellos',
        startYear: 1017,
        endYear: 1078,
      }),
    });
    assert.equal(personResponse.status, 201);
    const personEntity = await personResponse.json();

    const authoredItemResponse = await request('/api/knowledge-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'book',
        title: 'Chronographia',
        creator: 'Michael Psellos',
      }),
    });
    assert.equal(authoredItemResponse.status, 201);
    const authoredItem = await authoredItemResponse.json();

    const createdByResponse = await request(`/api/knowledge-items/${authoredItem.id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEntityType: 'reference_entity',
        toEntityId: personEntity.id,
        relationType: 'created_by',
      }),
    });
    assert.equal(createdByResponse.status, 201);

    const civilizationToEraResponse = await request(
      `/api/reference-entities/${updatedEntity.id}/outgoing-relations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEntityId: eraEntity.id,
          relationType: 'contains',
          note: 'This civilization includes the middle Byzantine period.',
        }),
      }
    );
    assert.equal(civilizationToEraResponse.status, 201);
    const civilizationToEraRelation = await civilizationToEraResponse.json();
    assert.equal(civilizationToEraRelation.toEntityTitle, 'Middle Byzantine Period');

    const civilizationToNationResponse = await request(
      `/api/reference-entities/${updatedEntity.id}/outgoing-relations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEntityId: nationEntity.id,
          relationType: 'contains',
          note: 'This civilization includes the Anatolian Theme.',
        }),
      }
    );
    assert.equal(civilizationToNationResponse.status, 201);
    const civilizationToNationRelation = await civilizationToNationResponse.json();
    assert.equal(civilizationToNationRelation.toEntityTitle, 'Anatolian Theme');

    const outgoingRelationsResponse = await request(
      `/api/reference-entities/${updatedEntity.id}/outgoing-relations`
    );
    assert.equal(outgoingRelationsResponse.status, 200);
    const outgoingRelations = await outgoingRelationsResponse.json();
    assert.equal(outgoingRelations.length, 2);
    assert.ok(outgoingRelations.every((relation) => relation.relationType === 'contains'));

    const personRelationsResponse = await request(`/api/reference-entities/${personEntity.id}/relations`);
    assert.equal(personRelationsResponse.status, 200);
    const personRelations = await personRelationsResponse.json();
    assert.ok(
      personRelations.some(
        (relation) =>
          relation.fromEntityType === 'knowledge_item' &&
          relation.relationType === 'created_by' &&
          relation.fromEntityTitle === 'Chronographia'
      )
    );

    const eraRelationsResponse = await request(`/api/reference-entities/${eraEntity.id}/relations`);
    assert.equal(eraRelationsResponse.status, 200);
    const eraRelations = await eraRelationsResponse.json();
    assert.ok(
      eraRelations.some(
        (relation) =>
          relation.fromEntityType === 'reference_entity' &&
          relation.relationType === 'contains' &&
          relation.fromEntityTitle === 'Eastern Roman Empire'
      )
    );

    const activityResponse = await request('/api/activity-events?limit=50');
    assert.equal(activityResponse.status, 200);
    const activityEvents = await activityResponse.json();
    const entityEvents = activityEvents.filter(
      (event) =>
        event.entityType === 'reference_entity' &&
        event.entityId === createdEntity.id
    );

    assert.ok(
      entityEvents.some((event) => event.type === 'reference_entity_created')
    );
    assert.ok(
      entityEvents.some((event) => event.type === 'reference_entity_updated')
    );
    assert.ok(
      entityEvents.filter((event) => event.type === 'relation_created').length >= 2
    );

    const deleteResponse = await request(`/api/reference-entities/${createdEntity.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 204);

    const danglingRelationResponse = await request(`/api/reference-entities/${eraEntity.id}/relations`);
    assert.equal(danglingRelationResponse.status, 200);
    const danglingRelations = await danglingRelationResponse.json();
    assert.ok(
      !danglingRelations.some(
        (relation) =>
          relation.fromEntityType === 'reference_entity' &&
          relation.fromEntityTitle === 'Eastern Roman Empire'
      )
    );

    const missingResponse = await request(`/api/reference-entities/${createdEntity.id}`);
    assert.equal(missingResponse.status, 404);
  });

  await t.test('GET /api/open-library/search proxies and normalizes Open Library results', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const parsedUrl = new URL(url);
      assert.match(parsedUrl.toString(), /openlibrary\.org\/search\.json/);
      assert.equal(parsedUrl.searchParams.get('limit'), '5');
      assert.equal(parsedUrl.searchParams.get('page'), '2');
      assert.match(parsedUrl.searchParams.get('q') ?? '', /foundation/);
      assert.match(parsedUrl.searchParams.get('q') ?? '', /author%3A|author:/);
      assert.match(parsedUrl.searchParams.get('q') ?? '', /language:eng/);

      return new Response(
        JSON.stringify({
          numFound: 21,
          docs: [
            {
              key: '/works/OL82563W',
              title: 'Foundation',
              subtitle: 'A Novel',
              author_name: ['Isaac Asimov'],
              publisher: ['Spectra'],
              first_publish_year: 1951,
              language: ['eng'],
              number_of_pages_median: 255,
              cover_i: 12345,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    };

    try {
      const response = await requestThroughHttp(
        '/api/open-library/search?q=foundation&author=asimov&language=eng&page=2&maxResults=5'
      );
      assert.equal(response.status, 200);

      const books = await response.json();
      assert.equal(books.page, 2);
      assert.equal(books.hasMore, true);
      assert.equal(books.nextPage, 3);
      assert.equal(books.total, 21);
      assert.equal(books.matches.length, 1);
      assert.deepEqual(books.matches[0], {
        id: '/works/OL82563W',
        authors: ['Isaac Asimov'],
        coverImageUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg?default=false',
        languageCodes: ['eng'],
        pageCount: 255,
        provider: 'open_library',
        publishedYear: 1951,
        publisher: 'Spectra',
        sourceUrl: 'https://openlibrary.org/works/OL82563W',
        subtitle: 'A Novel',
        title: 'Foundation',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('GET /api/library-of-congress/search proxies and normalizes LoC results', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const parsedUrl = new URL(url);
      assert.match(parsedUrl.toString(), /loc\.gov\/books\/\?/);
      assert.equal(parsedUrl.searchParams.get('fo'), 'json');
      assert.equal(parsedUrl.searchParams.get('c'), '10');
      assert.equal(parsedUrl.searchParams.get('sp'), '1');
      assert.equal(parsedUrl.searchParams.get('q'), 'hegel');
      assert.equal(parsedUrl.searchParams.get('fa'), 'contributor:kojeve|language:english');

      return new Response(
        JSON.stringify({
          pagination: {
            next: '/books/?sp=2',
            of: 18,
          },
          results: [
            {
              id: 'https://www.loc.gov/item/123456/',
              title: 'Introduction to the Reading of Hegel',
              contributor: ['Alexandre Kojeve'],
              date: '1947',
              language: ['eng'],
              image_url: ['https://tile.loc.gov/storage-services/service/pnp/example.jpg'],
              description: ['A lecture-based interpretation of Hegel.'],
              url: 'https://www.loc.gov/item/123456/',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    };

    try {
      const response = await requestThroughHttp(
        '/api/library-of-congress/search?q=hegel&author=kojeve&language=eng&page=1&maxResults=10'
      );
      assert.equal(response.status, 200);

      const books = await response.json();
      assert.equal(books.page, 1);
      assert.equal(books.hasMore, true);
      assert.equal(books.nextPage, 2);
      assert.equal(books.total, 18);
      assert.equal(books.matches.length, 1);
      assert.deepEqual(books.matches[0], {
        id: 'https://www.loc.gov/item/123456/',
        authors: ['Alexandre Kojeve'],
        coverImageUrl: 'https://tile.loc.gov/storage-services/service/pnp/example.jpg',
        description: 'A lecture-based interpretation of Hegel.',
        languageCodes: ['eng'],
        provider: 'library_of_congress',
        publishedYear: 1947,
        sourceUrl: 'https://www.loc.gov/item/123456/',
        title: 'Introduction to the Reading of Hegel',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('GET /api/library-of-congress/search supports author-only queries', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const parsedUrl = new URL(url);
      assert.match(parsedUrl.toString(), /loc\.gov\/books\/\?/);
      assert.equal(parsedUrl.searchParams.get('q'), null);
      assert.equal(parsedUrl.searchParams.get('fa'), 'contributor:asimov');

      return new Response(
        JSON.stringify({
          pagination: {
            of: 1,
          },
          results: [
            {
              id: 'https://www.loc.gov/item/654321/',
              title: 'Author-only result',
              contributor: ['Isaac Asimov'],
              url: 'https://www.loc.gov/item/654321/',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    };

    try {
      const response = await requestThroughHttp(
        '/api/library-of-congress/search?author=asimov&page=1&maxResults=10'
      );
      assert.equal(response.status, 200);

      const books = await response.json();
      assert.equal(books.matches.length, 1);
      assert.equal(books.matches[0].title, 'Author-only result');
      assert.deepEqual(books.matches[0].authors, ['Isaac Asimov']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
