import type { Database } from 'bun:sqlite';
import { ulid } from 'ulidx';
import type { GripEvent } from './event-types';

export interface StoredEvent {
  id: string;
  type: string;
  payload: string;
  created_at: number;
}

export class EventStore {
  constructor(private db: Database) {}

  append(event: GripEvent): string {
    const id = ulid();
    const now = Date.now();
    this.db
      .prepare('INSERT INTO events (id, type, payload, created_at) VALUES (?, ?, ?, ?)')
      .run(id, event.type, JSON.stringify(event), now);
    return id;
  }

  all(): StoredEvent[] {
    return this.db
      .prepare('SELECT * FROM events ORDER BY id ASC')
      .all() as StoredEvent[];
  }

  ofType(type: GripEvent['type']): StoredEvent[] {
    return this.db
      .prepare('SELECT * FROM events WHERE type = ? ORDER BY id ASC')
      .all(type) as StoredEvent[];
  }

  last(n: number): StoredEvent[] {
    return this.db
      .prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?')
      .all(n) as StoredEvent[];
  }

  count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as n FROM events')
      .get() as { n: number };
    return row.n;
  }
}
