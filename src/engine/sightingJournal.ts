/**
 * O2 (v4, #40): the first-sighting journal — a permanent record of what
 * the glass has shown. ONE source: the fact store + the kind enum +
 * seenFacts (the session-8 seam). The journal adds NO new facts and NO
 * new state shapes — only a record of inspections.
 *
 * A journal record is keyed by (kind, subject, season): inspecting the same
 * flower twice in one season writes ONE record; the same flower in a later
 * season writes a NEW one ("seen in every season" gives seasons a goal).
 */
import type { MagnifierEntry } from '../data/magnifierKinds';
import type { Season } from '../data/seasons';

export interface JournalRecord {
  /** the kind-enum entry kind: flower | visitor | structure */
  kind: 'flower' | 'visitor' | 'structure';
  /** the placed item/structure id, or the wildlife kind id */
  subject: string;
  /** the season at first sighting in that season */
  season: Season;
}

/** the dedup key — one record per (kind, subject, season) */
export function journalKey(r: JournalRecord): string {
  return `${r.kind}:${r.subject}:${r.season}`;
}

/** derive the record an inspection writes, or null when the entry carries
 *  no journalable subject (null entry). Pure — one source for the write
 *  path and the tests. */
export function recordForInspection(entry: MagnifierEntry, season: Season): JournalRecord | null {
  if (!entry) return null;
  if (entry.kind === 'flower') return { kind: 'flower', subject: entry.itemId, season };
  if (entry.kind === 'structure') return { kind: 'structure', subject: entry.structureId, season };
  return { kind: 'visitor', subject: entry.visitorId, season };
}

/** append a record if its key is not already present (idempotent per
 *  season). Pure: returns the next list, never mutates. */
export function appendRecord(list: JournalRecord[], record: JournalRecord): JournalRecord[] {
  const key = journalKey(record);
  if (list.some((r) => journalKey(r) === key)) return list;
  return [...list, record];
}
