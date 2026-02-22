import { getDb } from '../../core/db';
import { EventStore } from '../../core/events';
import { rebuild } from '../../core/projections';

export function rebuildCommand(_args: string[]): void {
  console.log('Rebuilding projections from event log…');

  const db = getDb();
  const store = new EventStore(db);
  const events = store.all();

  console.log(`  Found ${events.length} events.`);
  rebuild(db, events);

  console.log('Done. Projections rebuilt.');
}
