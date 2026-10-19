import { useEffect } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { checkMilestones } from '../engine/milestones';

/** Watches world state and fires milestone toasts when thresholds are met. */
export function MilestoneWatcher() {
  useEffect(() => {
    const check = () => {
      const s = usePlacementStore.getState();
      const events = checkMilestones(s.items, s.structures, s.milestones, s.wildSeasons);
      for (const e of events) s.earnMilestone(e.id, e.label, e.detail);
    };
    const unsub = usePlacementStore.subscribe(check);
    check();
    return unsub;
  }, []);
  return null;
}
