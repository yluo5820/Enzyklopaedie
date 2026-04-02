import {
  type KnowledgeRelationDetail,
  type KnowledgeRelationEntityType,
  type KnowledgeRelationType,
} from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { getKnowledgeItemLookup } from './knowledgeItems';
import { getReferenceEntityLookup } from './referenceEntities';
import { getStudyTopicById } from './studyTopics';
import { getTopicSummaryById } from './topics';

export interface RelationEntityLookup {
  id: number;
  entityType: KnowledgeRelationEntityType;
  title: string;
  kind: string;
}

export const isKnowledgeRelationType = (value: unknown): value is KnowledgeRelationType =>
  value === 'about' ||
  value === 'created_by' ||
  value === 'related_to' ||
  value === 'influenced_by' ||
  value === 'part_of' ||
  value === 'located_in' ||
  value === 'during' ||
  value === 'references';

export const isKnowledgeRelationEntityType = (value: unknown): value is KnowledgeRelationEntityType =>
  value === 'knowledge_item' ||
  value === 'topic' ||
  value === 'study_topic' ||
  value === 'reference_entity';

const relationDetailSelect = `
  SELECT
    kr.*,
    COALESCE(source_item.title, source_topic.name, source_study_topic.name, source_reference.title) AS fromEntityTitle,
    COALESCE(
      source_item.kind,
      CASE
        WHEN kr.fromEntityType = 'topic' THEN 'subject'
        WHEN kr.fromEntityType = 'study_topic' THEN 'topic'
      END,
      source_reference.kind
    ) AS fromEntityKind,
    COALESCE(target_item.title, target_topic.name, target_study_topic.name, target_reference.title) AS toEntityTitle,
    COALESCE(
      target_item.kind,
      CASE
        WHEN kr.toEntityType = 'topic' THEN 'subject'
        WHEN kr.toEntityType = 'study_topic' THEN 'topic'
      END,
      target_reference.kind
    ) AS toEntityKind
  FROM knowledge_relations kr
  LEFT JOIN knowledge_items source_item
    ON kr.fromEntityType = 'knowledge_item' AND kr.fromEntityId = source_item.id
  LEFT JOIN topics source_topic
    ON kr.fromEntityType = 'topic' AND kr.fromEntityId = source_topic.id
  LEFT JOIN study_topics source_study_topic
    ON kr.fromEntityType = 'study_topic' AND kr.fromEntityId = source_study_topic.id
  LEFT JOIN reference_entities source_reference
    ON kr.fromEntityType = 'reference_entity' AND kr.fromEntityId = source_reference.id
  LEFT JOIN knowledge_items target_item
    ON kr.toEntityType = 'knowledge_item' AND kr.toEntityId = target_item.id
  LEFT JOIN topics target_topic
    ON kr.toEntityType = 'topic' AND kr.toEntityId = target_topic.id
  LEFT JOIN study_topics target_study_topic
    ON kr.toEntityType = 'study_topic' AND kr.toEntityId = target_study_topic.id
  LEFT JOIN reference_entities target_reference
    ON kr.toEntityType = 'reference_entity' AND kr.toEntityId = target_reference.id
`;

export const getRelationEntityLookup = async (
  entityType: KnowledgeRelationEntityType,
  entityId: number
): Promise<RelationEntityLookup | null> => {
  if (entityType === 'knowledge_item') {
    const item = await getKnowledgeItemLookup(entityId);
    return item
      ? {
          id: item.id,
          entityType,
          title: item.title,
          kind: item.kind,
        }
      : null;
  }

  if (entityType === 'topic') {
    const topic = await getTopicSummaryById(entityId);
    return topic
      ? {
          id: topic.id,
          entityType,
          title: topic.name,
          kind: 'topic',
        }
      : null;
  }

  if (entityType === 'study_topic') {
    const topic = await getStudyTopicById(entityId);
    return topic
      ? {
          id: topic.id,
          entityType,
          title: topic.name,
          kind: 'topic',
        }
      : null;
  }

  const referenceEntity = await getReferenceEntityLookup(entityId);
  return referenceEntity
    ? {
        id: referenceEntity.id,
        entityType,
        title: referenceEntity.title,
        kind: referenceEntity.kind,
      }
    : null;
};

export const listKnowledgeRelationsBySource = async (
  fromEntityType: KnowledgeRelationEntityType,
  fromEntityId: number
) => {
  const db = await getDb();
  return db.all<KnowledgeRelationDetail[]>(
    `${relationDetailSelect}
     WHERE kr.fromEntityType = ? AND kr.fromEntityId = ?
     ORDER BY kr.createdAt DESC`,
    fromEntityType,
    fromEntityId
  );
};

export const findKnowledgeRelation = async (
  fromEntityType: KnowledgeRelationEntityType,
  fromEntityId: number,
  toEntityType: KnowledgeRelationEntityType,
  toEntityId: number,
  relationType: KnowledgeRelationType
) => {
  const db = await getDb();
  return db.get<KnowledgeRelationDetail>(
    `${relationDetailSelect}
     WHERE kr.fromEntityType = ?
       AND kr.fromEntityId = ?
       AND kr.toEntityType = ?
       AND kr.toEntityId = ?
       AND kr.relationType = ?`,
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    relationType
  );
};

export const listKnowledgeRelationsByTarget = async (
  toEntityType: KnowledgeRelationEntityType,
  toEntityId: number
) => {
  const db = await getDb();
  return db.all<KnowledgeRelationDetail[]>(
    `${relationDetailSelect}
     WHERE kr.toEntityType = ? AND kr.toEntityId = ?
     ORDER BY kr.createdAt DESC`,
    toEntityType,
    toEntityId
  );
};

export const getKnowledgeRelationById = async (relationId: number) => {
  const db = await getDb();
  return db.get<KnowledgeRelationDetail>(
    `${relationDetailSelect}
     WHERE kr.id = ?`,
    relationId
  );
};
