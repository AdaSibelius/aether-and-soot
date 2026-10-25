import { SimEvent } from '../../schemas/events.schema.js';
import { formatEventMessage } from './EventFormatter.js';

function getMovementDirection(dx: number, dy: number): string {
  if (dy < 0 && dx === 0) return 'North ';
  if (dy > 0 && dx === 0) return 'South ';
  if (dx > 0 && dy === 0) return 'East ';
  if (dx < 0 && dy === 0) return 'West ';
  if (dy < 0 && dx > 0) return 'North-East ';
  if (dy < 0 && dx < 0) return 'North-West ';
  if (dy > 0 && dx > 0) return 'South-East ';
  if (dy > 0 && dx < 0) return 'South-West ';
  return '';
}

export function aggregateChronicleEvents(events: readonly SimEvent[], maxLines?: number): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < events.length) {
    const ev = events[i];
    if (!ev) { i++; continue; }
    if (ev.type === 'ENTITY_MOVED') {
      let j = i + 1;
      let totalAp = ev.apSpent;
      while (j < events.length && events[j]?.type === 'ENTITY_MOVED' && (events[j] as typeof ev).actorId === ev.actorId) {
        totalAp += (events[j] as typeof ev).apSpent;
        j++;
      }
      const count = j - i;
      if (count > 1) {
        const lastMove = events[j - 1] as typeof ev;
        const dx = lastMove.to.x - ev.from.x;
        const dy = lastMove.to.y - ev.from.y;
        const dir = getMovementDirection(dx, dy);
        const turnRange = ev.turn === lastMove.turn ? `[T${ev.turn}]` : `[T${ev.turn}–T${lastMove.turn}]`;
        result.push(`${turnRange} Traversed ${count}m ${dir}to (${lastMove.to.x}, ${lastMove.to.y}) on ${lastMove.to.stratum} [${totalAp} AP]`);
      } else {
        result.push(formatEventMessage(ev));
      }
      i = j;
    } else {
      result.push(formatEventMessage(ev));
      i++;
    }
  }
  return typeof maxLines === 'number' && maxLines > 0 ? result.slice(-maxLines) : result;
}
