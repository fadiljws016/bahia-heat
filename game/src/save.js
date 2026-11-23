// save.js — progress persistence in localStorage: cash, respect, story
// position, unlocked weapons and their ammo pools, garage upgrade levels.
// Written after every job and every garage purchase (writeSave), offered
// back on the title screen as Continue (readSave). Screenshot modes never
// touch it.

import { G } from './state.js';

const KEY = 'bahia-heat-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function writeSave() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      cash: G.cash,
      respect: G.respect,
      rankIndex: G.rankIndex,
      missionIndex: G.missionIndex,
      completedJobs: G.completedJobs,
      unlockedWeapons: G.unlockedWeapons,
      ammo: G.ammo,
      garageLevels: G.garageLevels,
      taxiFaresDone: G.taxiFaresDone,
    }));
  } catch { /* storage unavailable (private mode): the run simply isn't kept */ }
}

/** Load the save into G; returns false when there is nothing usable. */
export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || typeof s.cash !== 'number') return false;
    G.cash = s.cash;
    G.respect = s.respect ?? 0;
    G.rankIndex = s.rankIndex ?? 0;
    G.missionIndex = s.missionIndex ?? 0;
    G.completedJobs = Array.isArray(s.completedJobs) ? s.completedJobs : [];
    if (Array.isArray(s.unlockedWeapons) && s.unlockedWeapons.length) G.unlockedWeapons = s.unlockedWeapons;
    if (s.ammo) Object.assign(G.ammo, s.ammo);
    if (s.garageLevels) Object.assign(G.garageLevels, s.garageLevels);
    G.taxiFaresDone = s.taxiFaresDone ?? 0;
    return true;
  } catch { return false; }
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to wipe */ }
}
