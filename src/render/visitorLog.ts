import { usePlacementStore } from './placementStore';

/**
 * Session 7 U2: the visitor log — "who visited, when" for the notebook.
 *
 * ONE entry per visit-WINDOW: a visitor species appearing during a season
 * records that (visitor, season) pair ONCE; repeated sightings in the same
 * window never re-record (the gate asserts this). The window key is the
 * (visitorId, season) pair — the season label at visit time.
 *
 * State lives in the placement store (persisted, v7 additive) so the P
 * panel, notebook hub, and save round-trip all read ONE source. This
 * module is the single write path: the WildPollinators render calls
 * recordVisitorWindow when a species' natural conditions first produce a
 * visitor that frame — never the spawn itself, only the condition.
 */
export function recordVisitorWindow(visitorId: string, season: string): void {
  const s = usePlacementStore.getState();
  const key = `${visitorId}:${season}`;
  if (s.visitorWindows.includes(key)) return;
  usePlacementStore.setState({ visitorWindows: [...s.visitorWindows, key] });
  s.save();
}
