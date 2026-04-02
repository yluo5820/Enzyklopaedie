import { NextFunction, Request, Response } from 'express';
import { type KnowledgeRelationEntityType } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  findKnowledgeRelation,
  getKnowledgeRelationById,
  getRelationEntityLookup,
  isKnowledgeRelationEntityType,
  isKnowledgeRelationType,
  listKnowledgeRelationsBySource,
} from '../lib/knowledgeRelations';
import { getStudyTopicById } from '../lib/studyTopics';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getStudyTopicFromParams = async (req: Request, res: Response) => {
  const studyTopicId = parseId(req.params.id);
  if (!studyTopicId) {
    res.status(400).json({ message: 'Invalid topic id' });
    return null;
  }

  const topic = await getStudyTopicById(studyTopicId);
  if (!topic) {
    res.status(404).json({ message: 'Topic not found' });
    return null;
  }

  return topic;
};

export const getRelationsByStudyTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const topic = await getStudyTopicFromParams(req, res);
  if (!topic) return;

  res.json(await listKnowledgeRelationsBySource('study_topic', topic.id));
});

export const createStudyTopicRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const topic = await getStudyTopicFromParams(req, res);
  if (!topic) return;

  const toEntityType = (req.body.toEntityType ?? 'reference_entity') as KnowledgeRelationEntityType;
  if (!isKnowledgeRelationEntityType(toEntityType)) {
    return res.status(400).json({ message: 'Invalid target entity type' });
  }

  const toEntityId = parseId(req.body.toEntityId);
  if (!toEntityId) {
    return res.status(400).json({ message: 'A valid target entity id is required' });
  }

  if (toEntityType === 'study_topic' && toEntityId === topic.id) {
    return res.status(400).json({ message: 'A topic cannot be related to itself' });
  }

  const relationType = req.body.relationType;
  if (!isKnowledgeRelationType(relationType)) {
    return res.status(400).json({ message: 'Invalid relation type' });
  }

  const db = await getDb();
  const targetEntity = await getRelationEntityLookup(toEntityType, toEntityId);
  if (!targetEntity) {
    return res.status(404).json({ message: 'Target entity not found' });
  }

  const existingRelation = await findKnowledgeRelation(
    'study_topic',
    topic.id,
    toEntityType,
    toEntityId,
    relationType
  );
  if (existingRelation) {
    return res.status(200).json(existingRelation);
  }

  const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;
  const createdAt = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO knowledge_relations
      (fromEntityType, fromEntityId, toEntityType, toEntityId, relationType, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'study_topic',
    topic.id,
    toEntityType,
    toEntityId,
    relationType,
    note,
    createdAt
  );

  const relation = await getKnowledgeRelationById(result.lastID as number);

  await recordActivityEvent({
    type: 'relation_created',
    entityType: 'study_topic',
    entityId: topic.id,
    message: `Linked topic "${topic.name}" to "${targetEntity.title}"`,
    metadata: {
      relationType,
      toEntityType,
      toEntityId,
      toEntityTitle: targetEntity.title,
    },
  });

  res.status(201).json(relation);
});

export const deleteStudyTopicRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const topic = await getStudyTopicFromParams(req, res);
  if (!topic) return;

  const relationId = parseId(req.params.relationId);
  if (!relationId) {
    return res.status(400).json({ message: 'Invalid relation id' });
  }

  const db = await getDb();
  const result = await db.run(
    `DELETE FROM knowledge_relations
     WHERE id = ? AND fromEntityType = 'study_topic' AND fromEntityId = ?`,
    relationId,
    topic.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Topic relation not found' });
  }

  res.status(204).send();
});
