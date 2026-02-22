import { getDb } from '../../core/db';
import { EventStore } from '../../core/events';
import { applyEvent } from '../../core/projections';
import { ulid } from 'ulidx';

export function microCommand(args: string[]): void {
  const body = args.join(' ').trim();
  if (!body) {
    console.error('Usage: grip micro "text of micro-post"');
    process.exit(1);
  }

  const db = getDb();
  const store = new EventStore(db);

  const id = ulid();
  const event = { type: 'MicroPostCreated' as const, id, body };
  store.append(event);
  applyEvent(db, event, Date.now());

  console.log(`Micro-post created: ${id}`);
  console.log(`  Body: ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}`);
}
