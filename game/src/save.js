// save.js — progression in localStorage: cash, respect, unlocked
// weapons, ammo, and the next mission index. Deliberately tiny and
// defensive: a corrupt save reads as no save, and a failed write (private
// mode, quota) just means this run doesn't persist.

import { G } from './state.js';

const KEY = 'bahia-heat-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function writeSave(data) {
  try {
    const payload = data ?? {
      cash: G.cash,
      respect: G.respect,
      unlocked: G.weapons.unlocked,
      ammo: G.weapons.ammo,
      missionIndex: G.missionIndex,
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* the run just doesn't persist */
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Apply a stored save (if any) onto G. Returns true when one applied. */
export function loadSave() {
  const data = readSave();
  if (!data) return false;
  G.cash = data.cash;
  G.respect = typeof data.respect === 'number' ? data.respect : 0;
  if (data.unlocked) Object.assign(G.weapons.unlocked, data.unlocked);
  if (data.ammo) Object.assign(G.weapons.ammo, data.ammo);
  if (typeof data.missionIndex === 'number') G.missionIndex = data.missionIndex;
  return true;
}

export function wipeSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to wipe */
  }
}
