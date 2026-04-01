import { NextFunction, Request, Response } from 'express';
import {
  KnowledgeRelationDetail,
  KnowledgeRelationType,
} from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import { getKnowledgeItemLookup } from '../lib/knowledgeItems';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type KnowledgeRelationRow = KnowledgeRelationDetail;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isKnowledgeRelationType = (value: unknown): value is KnowledgeRelationType =>
  value === 'about' ||
  value === 'related_to' ||
  value === 'influenced_by' ||
  value === 'part_of' ||
  value === 'located_in' ||
  value === 'during' ||
  value === 'references';

const getKnowledgeItemFromParams = async (req: Request, res: Response) => {
  const knowledgeItemId = parseId(req.params.knowledgeItemId);
  if (!knowledgeItemId) {
    res.status(400).json({ message: 'Invalid knowledge item id' });
    return null;
  }

  const item = await getKnowledgeItemLookup(knowledgeItemId);
  if (!item) {
    res.status(404).json({ message: 'Knowledge item not found' });
    return null;
  }

  return item;
};

const fetchRelationsForItem = async (knowledgeItemId: number) => {
  const db = await getDb();
  return db.all<KnowledgeRelationRow[]>(
    `SELECT
        kr.*,
        source.title AS fromEntityTitle,
        source.kind AS fromEntityKind,
        target.title AS toEntityTitle,
        target.kind AS toEntityKind
      FROM knowledge_relations kr
      LEFT JOIN knowledge_items source
        ON kr.fromEntityType = 'knowledge_item' AND kr.fromEntityId = source.id
      LEFT JOIN knowledge_items target
        ON kr.toEntityType = 'knowledge_item' AND kr.toEntityId = target.id
      WHERE kr.fromEntityType = 'knowledge_item' AND kr.fromEntityId = ?
      ORDER BY kr.createdAt DESC`,
    knowledgeItemId
  );
};

export const getRelationsByKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  res.json(await fetchRelationsForItem(item.id));
});

export const createKnowledgeRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const toEntityId = parseId(req.body.toEntityId);
  if (!toEntityId) {
    return res.status(400).json({ message: 'A valid target knowledge item id is required' });
  }

  if (toEntityId === item.id) {
    return res.status(400).json({ message: 'An item cannot be related to itself' });
  }

  const relationType = req.body.relationType;
  if (!isKnowledgeRelationType(relationType)) {
    return res.status(400).json({ message: 'Invalid relation type' });
  }

  const db = await getDb();
  const targetItem = await getKnowledgeItemLookup(toEntityId);
  if (!targetItem) {
    return res.status(404).json({ message: 'Target knowledge item not found' });
  }

  const existingRelation = await db.get<KnowledgeRelationRow>(
    `SELECT
        kr.*,
        source.title AS fromEntityTitle,
        source.kind AS fromEntityKind,
        target.title AS toEntityTitle,
        target.kind AS toEntityKind
      FROM knowledge_relations kr
      LEFT JOIN knowledge_items source
        ON kr.fromEntityType = 'knowledge_item' AND kr.fromEntityId = source.id
      LEFT JOIN knowledge_items target
        ON kr.toEntityType = 'knowledge_item' AND kr.toEntityId = target.id
      WHERE kr.fromEntityType = 'knowledge_item'
        AND kr.fromEntityId = ?
        AND kr.toEntityType = 'knowledge_item'
        AND kr.toEntityId = ?
        AND kr.relationType = ?`,
    item.id,
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
    'knowledge_item',
    item.id,
    'knowledge_item',
    toEntityId,
    relationType,
    note,
    createdAt
  );

  const relation = await db.get<KnowledgeRelationRow>(
    `SELECT
        kr.*,
        source.title AS fromEntityTitle,
        source.kind AS fromEntityKind,
        target.title AS toEntityTitle,
        target.kind AS toEntityKind
      FROM knowledge_relations kr
      LEFT JOIN knowledge_items source
        ON kr.fromEntityType = 'knowledge_item' AND kr.fromEntityId = source.id
      LEFT JOIN knowledge_items target
        ON kr.toEntityType = 'knowledge_item' AND kr.toEntityId = target.id
      WHERE kr.id = ?`,
    result.lastID
  );

  await recordActivityEvent({
    type: 'relation_created',
    entityType: 'knowledge_item',
    entityId: item.id,
    message: `Linked "${item.title}" to "${targetItem.title}"`,
    metadata: {
      relationType,
      toEntityId,
      toEntityTitle: targetItem.title,
    },
  });

  res.status(201).json(relation);
});

export const deleteKnowledgeRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const relationId = parseId(req.params.id);
  if (!relationId) {
    return res.status(400).json({ message: 'Invalid relation id' });
  }

  const db = await getDb();
  const result = await db.run(
    `DELETE FROM knowledge_relations
     WHERE id = ? AND fromEntityType = 'knowledge_item' AND fromEntityId = ?`,
    relationId,
    item.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge relation not found' });
  }

  res.status(204).send();
});
