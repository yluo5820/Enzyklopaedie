import { NextFunction, Request, Response } from 'express';
import { NewStudyTopic, StudyTopic } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  generateUniqueStudyTopicSlug,
  getStudyTopicById,
  listKnowledgeItemsForStudyTopic,
  listStudyTopics,
} from '../lib/studyTopics';
import { getTopicSummaryById } from '../lib/topics';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getAllStudyTopics = asyncErrorHandler(async (req: Request, res: Response) => {
  const requestedSubjectId = req.query.subjectId;
  const parsedSubjectId = requestedSubjectId === undefined ? null : parseId(requestedSubjectId);

  if (requestedSubjectId !== undefined && !parsedSubjectId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  res.json(await listStudyTopics(parsedSubjectId ?? undefined));
});

export const getStudyTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const studyTopicId = parseId(req.params.id);
  if (!studyTopicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const topic = await getStudyTopicById(studyTopicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  res.json(topic);
});

export const getKnowledgeItemsByStudyTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const studyTopicId = parseId(req.params.id);
  if (!studyTopicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const topic = await getStudyTopicById(studyTopicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  res.json(await listKnowledgeItemsForStudyTopic(studyTopicId));
});

export const createStudyTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newStudyTopic: NewStudyTopic = req.body;
  const name = typeof newStudyTopic.name === 'string' ? newStudyTopic.name.trim() : '';

  if (!name) {
    return res.status(400).json({ message: 'Topic name is required' });
  }

  const subjectId = parseId(newStudyTopic.subjectId);
  if (!subjectId) {
    return res.status(400).json({ message: 'A valid subject id is required' });
  }

  const subject = await getTopicSummaryById(subjectId);
  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const requestedParentTopicId = newStudyTopic.parentTopicId
    ? parseId(newStudyTopic.parentTopicId)
    : null;
  if (newStudyTopic.parentTopicId !== undefined && !requestedParentTopicId) {
    return res.status(400).json({ message: 'Invalid parent topic id' });
  }

  if (requestedParentTopicId) {
    const parent = await getStudyTopicById(requestedParentTopicId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent topic not found' });
    }

    if (parent.subjectId !== subject.id) {
      return res.status(400).json({ message: 'Parent topic must belong to the same subject' });
    }
  }

  const existingTopic = requestedParentTopicId
    ? await db.get<StudyTopic>(
        `SELECT * FROM study_topics
         WHERE subjectId = ? AND parentTopicId = ? AND lower(name) = lower(?)`,
        subject.id,
        requestedParentTopicId,
        name
      )
    : await db.get<StudyTopic>(
        `SELECT * FROM study_topics
         WHERE subjectId = ? AND parentTopicId IS NULL AND lower(name) = lower(?)`,
        subject.id,
        name
      );

  if (existingTopic) {
    const existingSummary = await getStudyTopicById(existingTopic.id);
    return res.status(200).json(existingSummary);
  }

  const slug = await generateUniqueStudyTopicSlug(db, name, subject.slug);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO study_topics
      (subjectId, name, slug, summary, description, parentTopicId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    subject.id,
    name,
    slug,
    newStudyTopic.summary?.trim() || null,
    newStudyTopic.description?.trim() || null,
    requestedParentTopicId,
    now,
    now
  );

  const createdTopic = await getStudyTopicById(result.lastID as number);

  await recordActivityEvent({
    type: 'topic_created',
    entityType: 'study_topic',
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

export const deleteStudyTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const studyTopicId = parseId(req.params.id);
  if (!studyTopicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const existingTopic = await getStudyTopicById(studyTopicId);
  if (!existingTopic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  const childTopic = await db.get('SELECT id FROM study_topics WHERE parentTopicId = ? LIMIT 1', studyTopicId);
  if (childTopic) {
    return res.status(409).json({ message: 'Remove child topics before deleting this topic' });
  }

  const assignedItem = await db.get(
    'SELECT knowledgeItemId FROM knowledge_item_study_topics WHERE studyTopicId = ? LIMIT 1',
    studyTopicId
  );
  if (assignedItem) {
    return res.status(409).json({ message: 'Remove this topic’s items before deleting it' });
  }

  await db.run(
    `DELETE FROM knowledge_relations
     WHERE (fromEntityType = 'study_topic' AND fromEntityId = ?)
        OR (toEntityType = 'study_topic' AND toEntityId = ?)`,
    studyTopicId,
    studyTopicId
  );
  await db.run('DELETE FROM study_topics WHERE id = ?', studyTopicId);

  await recordActivityEvent({
    type: 'topic_deleted',
    entityType: 'study_topic',
    entityId: studyTopicId,
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
