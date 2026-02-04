import Database from 'better-sqlite3';
import db from './db';

export type ReaderType = 'bot' | 'human';

export interface LastMessagePreview {
  content: string;
  sender_id: string;
  sender_type: ReaderType;
  created_at: string;
}

export function markMatchRead(
  dbHandle: Database.Database,
  matchId: number,
  readerId: string,
  readerType: ReaderType,
  lastReadMessageId: number
) {
  if (!lastReadMessageId || lastReadMessageId <= 0) {
    return;
  }

  dbHandle.prepare(`
    INSERT INTO match_reads (match_id, reader_id, reader_type, last_read_message_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(match_id, reader_id, reader_type)
    DO UPDATE SET
      last_read_message_id = CASE
        WHEN excluded.last_read_message_id > match_reads.last_read_message_id
        THEN excluded.last_read_message_id
        ELSE match_reads.last_read_message_id
      END,
      updated_at = CURRENT_TIMESTAMP
  `).run(matchId, readerId, readerType, lastReadMessageId);
}

export function fetchLastMessages(matchIds: number[]): Record<number, LastMessagePreview> {
  if (matchIds.length === 0) {
    return {};
  }

  const placeholders = matchIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT m1.match_id, m1.content, m1.sender_id, m1.sender_type, m1.created_at
    FROM messages m1
    JOIN (
      SELECT match_id, MAX(id) as max_id
      FROM messages
      WHERE match_id IN (${placeholders})
      GROUP BY match_id
    ) mx ON m1.match_id = mx.match_id AND m1.id = mx.max_id
  `).all(...matchIds) as (LastMessagePreview & { match_id: number })[];

  return rows.reduce<Record<number, LastMessagePreview>>((acc, row) => {
    acc[row.match_id] = {
      content: row.content,
      sender_id: row.sender_id,
      sender_type: row.sender_type,
      created_at: row.created_at,
    };
    return acc;
  }, {});
}

export function fetchUnreadCounts(
  matchIds: number[],
  readerId: string,
  readerType: ReaderType
): Record<number, number> {
  if (matchIds.length === 0) {
    return {};
  }

  const placeholders = matchIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT msg.match_id as match_id, COUNT(*) as unread_count
    FROM messages msg
    LEFT JOIN match_reads mr
      ON mr.match_id = msg.match_id
      AND mr.reader_id = ?
      AND mr.reader_type = ?
    WHERE msg.match_id IN (${placeholders})
      AND msg.id > COALESCE(mr.last_read_message_id, 0)
      AND NOT (msg.sender_id = ? AND msg.sender_type = ?)
    GROUP BY msg.match_id
  `).all(readerId, readerType, ...matchIds, readerId, readerType) as {
    match_id: number;
    unread_count: number;
  }[];

  return rows.reduce<Record<number, number>>((acc, row) => {
    acc[row.match_id] = row.unread_count;
    return acc;
  }, {});
}
