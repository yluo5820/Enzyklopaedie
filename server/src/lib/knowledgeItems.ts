import { getDb } from '../db';

export interface KnowledgeItemLookup {
  id: number;
  kind: string;
  title: string;
  status: string;
}

export const getKnowledgeItemLookup = async (knowledgeItemId: number) => {
  const db = await getDb();
  return db.get<KnowledgeItemLookup>(
    'SELECT id, kind, title, status FROM knowledge_items WHERE id = ?',
    knowledgeItemId
  );
};
