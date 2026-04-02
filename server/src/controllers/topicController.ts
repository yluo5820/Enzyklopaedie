import { NextFunction, Request, Response } from 'express';
import { NewTopic, Topic } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  generateUniqueTopicSlug,
  getTopicById as getTopicSummaryById,
  listKnowledgeItemsForTopic,
  listTopics,
} from '../lib/topics';
import { getSubjectSummaryById } from '../lib/subjects';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getAllTopics = asyncErrorHandler(async (req: Request, res: Response) => {
  const requestedSubjectId = req.query.subjectId;
  const parsedSubjectId = requestedSubjectId === undefined ? null : parseId(requestedSubjectId);

  if (requestedSubjectId !== undefined && !parsedSubjectId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  res.json(await listTopics(parsedSubjectId ?? undefined));
});

export const getTopicByIdRoute = asyncErrorHandler(async (req: Request, res: Response) => {
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const topic = await getTopicSummaryById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  res.json(topic);
});

export const getKnowledgeItemsByTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const topic = await getTopicSummaryById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  res.json(await listKnowledgeItemsForTopic(topicId));
});

export const createTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newTopic: NewTopic = req.body;
  const name = typeof newTopic.name === 'string' ? newTopic.name.trim() : '';

  if (!name) {
    return res.status(400).json({ message: 'Topic name is required' });
  }

  const subjectId = parseId(newTopic.subjectId);
  if (!subjectId) {
    return res.status(400).json({ message: 'A valid subject id is required' });
  }

  const subject = await getSubjectSummaryById(subjectId);
  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const requestedParentTopicId = newTopic.parentTopicId ? parseId(newTopic.parentTopicId) : null;
  if (newTopic.parentTopicId !== undefined && !requestedParentTopicId) {
    return res.status(400).json({ message: 'Invalid parent topic id' });
  }

  if (requestedParentTopicId) {
    const parent = await getTopicSummaryById(requestedParentTopicId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent topic not found' });
    }

    if (parent.subjectId !== subject.id) {
      return res.status(400).json({ message: 'Parent topic must belong to the same subject' });
    }
  }

  const existingTopic = requestedParentTopicId
    ? await db.get<Topic>(
        `SELECT * FROM study_topics
         WHERE subjectId = ? AND parentTopicId = ? AND lower(name) = lower(?)`,
        subject.id,
        requestedParentTopicId,
        name
      )
    : await db.get<Topic>(
        `SELECT * FROM study_topics
         WHERE subjectId = ? AND parentTopicId IS NULL AND lower(name) = lower(?)`,
        subject.id,
        name
      );

  if (existingTopic) {
    const existingSummary = await getTopicSummaryById(existingTopic.id);
    return res.status(200).json(existingSummary);
  }

  const slug = await generateUniqueTopicSlug(db, name, subject.slug);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO study_topics
      (subjectId, name, slug, summary, description, parentTopicId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    subject.id,
    name,
    slug,
    newTopic.summary?.trim() || null,
    newTopic.description?.trim() || null,
    requestedParentTopicId,
    now,
    now
  );

  const createdTopic = await getTopicSummaryById(result.lastID as number);

  await recordActivityEvent({
    type: 'topic_created',
    entityType: 'topic',
    entityId: result.lastID as number,
    message: `Created topic "${name}" in subject "${subject.name}"`,
    metadata: {
      slug,
      subjectId: subject.id,
      subjectName: subject.name,
      parentTopicId: requestedParentTopicId,
    },
  });

  res.status(201).json(createdTopic);
});

export const deleteTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const existingTopic = await getTopicSummaryById(topicId);
  if (!existingTopic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  const childTopic = await db.get('SELECT id FROM study_topics WHERE parentTopicId = ? LIMIT 1', topicId);
  if (childTopic) {
    return res.status(409).json({ message: 'Remove child topics before deleting this topic' });
  }

  const assignedItem = await db.get(
    'SELECT knowledgeItemId FROM knowledge_item_study_topics WHERE studyTopicId = ? LIMIT 1',
    topicId
  );
  if (assignedItem) {
    return res.status(409).json({ message: 'Remove this topic’s items before deleting it' });
  }

  await db.run(
    `DELETE FROM knowledge_relations
     WHERE (fromEntityType = 'topic' AND fromEntityId = ?)
        OR (toEntityType = 'topic' AND toEntityId = ?)`,
    topicId,
    topicId
  );
  await db.run('DELETE FROM study_topics WHERE id = ?', topicId);

  await recordActivityEvent({
    type: 'topic_deleted',
    entityType: 'topic',
    entityId: topicId,
    message: `Deleted topic "${existingTopic.name}" from subject "${existingTopic.subjectName}"`,
    metadata: {
      subjectId: existingTopic.subjectId,
      subjectName: existingTopic.subjectName,
      parentTopicId: existingTopic.parentTopicId ?? null,
      slug: existingTopic.slug,
    },
  });

  res.status(204).send();
});

export { getTopicByIdRoute as getTopicById };
