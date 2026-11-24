// save.js — progression persistence in localStorage: cash, respect,
// unlocks, ammo and the mission index survive a reload. Nothing else
// leaves the machine; there is no account and no network save.

import { G } from './state.js';
import { rankFor } from './state.js';

const KEY = 'bahia-heat-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function writeSave() {
  try {
    const data = {
      cash: G.cash,
      respect: G.respect,
      unlocked: G.unlocked,
      ammo: G.ammo,
      missionIndex: G.mission ? G.mission.index : (G.savedMissionIndex || 0),
      timeHours: G.timeHours,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash === 'number') G.cash = data.cash;
    if (typeof data.respect === 'number') {
      G.respect = data.respect;
      G.rankIndex = rankFor(data.respect).index;
    }
    if (data.unlocked) Object.assign(G.unlocked, data.unlocked);
    if (data.ammo) Object.assign(G.ammo, data.ammo);
    if (typeof data.timeHours === 'number') G.timeHours = data.timeHours;
    G.savedMissionIndex = data.missionIndex || 0;
    return data;
  } catch (e) {
    return null;
  }
}

export function wipeSave() {
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch (e) {
    return false;
  }
}
