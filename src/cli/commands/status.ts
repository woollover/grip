import { getDb } from '../../core/db';
import { EventStore } from '../../core/events';

export function statusCommand(_args: string[]): void {
  const db = getDb();
  const store = new EventStore(db);

  const total = store.count();
  const recent = store.last(20);

  console.log(`GRIP status — ${total} total events\n`);

  if (recent.length === 0) {
    console.log('No events yet. Run: grip setup');
    return;
  }

  const rows = recent.reverse().map(e => {
    const date = new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 19);
    return `  ${date}  ${e.type.padEnd(22)}  ${e.id}`;
  });

  console.log('  When                 Type                    ID');
  console.log('  ' + '-'.repeat(70));
  console.log(rows.join('\n'));
}
