import { KnowledgeItem, TopicSummary } from '@enzyklopaedie/shared';
import { getDb } from '../db';

const topicSummarySelect = `
  SELECT
    t.*,
    COALESCE(item_counts.knowledgeItemCount, 0) AS knowledgeItemCount,
    COALESCE(child_counts.childTopicCount, 0) AS childTopicCount
  FROM topics t
  LEFT JOIN (
    SELECT topicId, COUNT(*) AS knowledgeItemCount
    FROM knowledge_item_topics
    GROUP BY topicId
  ) item_counts ON item_counts.topicId = t.id
  LEFT JOIN (
    SELECT parentTopicId, COUNT(*) AS childTopicCount
    FROM topics
    WHERE parentTopicId IS NOT NULL
    GROUP BY parentTopicId
  ) child_counts ON child_counts.parentTopicId = t.id
`;

export const listTopicSummaries = async () => {
  const db = await getDb();
  return db.all<TopicSummary[]>(
    `${topicSummarySelect}
     ORDER BY CASE WHEN t.slug = 'ontology' THEN 0 ELSE 1 END, lower(t.name) ASC, t.createdAt ASC`
  );
};

export const getTopicSummaryById = async (topicId: number) => {
  const db = await getDb();
  return db.get<TopicSummary>(
    `${topicSummarySelect}
     WHERE t.id = ?`,
    topicId
  );
};

export const getOntologyTopic = async () => {
  const db = await getDb();
  return db.get<TopicSummary>(
    `${topicSummarySelect}
     WHERE t.slug = 'ontology'`
  );
};

export const listKnowledgeItemsForTopic = async (topicId: number) => {
  const db = await getDb();
  return db.all<KnowledgeItem[]>(
    `SELECT ki.*
     FROM knowledge_item_topics kit
     INNER JOIN knowledge_items ki ON ki.id = kit.knowledgeItemId
     WHERE kit.topicId = ?
     ORDER BY ki.updatedAt DESC`,
    topicId
  );
};
