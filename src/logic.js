// Recommendation engine — transparent, rule-based strength-coaching heuristics.
// Every recommendation carries a `why` string so the trainer can sanity-check it.

import { GOALS } from './seed.js';

export const epley1RM = (weight, reps) =>
  reps > 0 ? Math.round(weight * (1 + reps / 30) * 10) / 10 : 0;

export function repRangeFor(client) {
  const g = GOALS.find((g) => g.id === (client?.goal || 'general'));
  return g ? g.reps : [8, 12];
}

export function roundToIncrement(w, units, region) {
  const inc = units === 'kg' ? (region === 'lower' ? 2.5 : 1.25) : (region === 'lower' ? 5 : 2.5);
  return Math.max(inc, Math.round(w / inc) * inc);
}

// History = this client's sessions, newest first. Returns entries for one exercise.
export function historyFor(sessions, exerciseId) {
  const out = [];
  for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const en of s.entries || []) {
      if (en.exerciseId === exerciseId && (en.sets || []).length) {
        out.push({ date: s.date, sets: en.sets });
      }
    }
  }
  return out;
}

export function bestE1RM(sets) {
  let best = 0;
  for (const st of sets) {
    const e = epley1RM(Number(st.weight) || 0, Number(st.reps) || 0);
    if (e > best) best = e;
  }
  return best;
}

export function e1rmSeries(sessions, exerciseId) {
  return historyFor(sessions, exerciseId)
    .map((h) => ({ x: h.date, y: bestE1RM(h.sets) }))
    .filter((p) => p.y > 0)
    .sort((a, b) => a.x.localeCompare(b.x));
}

// ---- Injury screening ----
export function injuryConflicts(exercise, client) {
  const inj = client?.injuries || [];
  return (exercise.contra || []).filter((t) => inj.includes(t));
}

export function safeAlternatives(exercise, client, allExercises) {
  return allExercises
    .filter((e) =>
      e.pattern === exercise.pattern &&
      e.id !== exercise.id &&
      injuryConflicts(e, client).length === 0)
    .sort((a, b) => Math.abs(a.level - exercise.level) - Math.abs(b.level - exercise.level))
    .slice(0, 3);
}

function chainNeighbor(exercise, allExercises, dir, client) {
  const chain = allExercises
    .filter((e) => e.pattern === exercise.pattern && (!client || injuryConflicts(e, client).length === 0))
    .sort((a, b) => a.level - b.level);
  const idx = chain.findIndex((e) => e.id === exercise.id);
  if (idx === -1) {
    // exercise itself may be contraindicated; find nearest level in dir
    const cands = chain.filter((e) => dir > 0 ? e.level > exercise.level : e.level < exercise.level);
    return dir > 0 ? cands[0] : cands[cands.length - 1];
  }
  return chain[idx + dir];
}
export const progressionOf = (ex, all, client) => chainNeighbor(ex, all, +1, client);
export const regressionOf = (ex, all, client) => chainNeighbor(ex, all, -1, client);

const avgRPE = (sets) => {
  const r = sets.map((s) => Number(s.rpe)).filter((x) => x > 0);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
};
const topWeight = (sets) => Math.max(...sets.map((s) => Number(s.weight) || 0));
const minReps = (sets) => Math.min(...sets.map((s) => Number(s.reps) || 0));

// ---- The core: what should this client do next time on this exercise? ----
// Returns { kind, sets, reps, weight?, seconds?, why, switchTo?, conflicts }
export function recommend(exercise, client, sessions, allExercises, units) {
  const conflicts = injuryConflicts(exercise, client);
  const hist = historyFor(sessions, exercise.id);
  const [lo, hi] = repRangeFor(client);
  const base = { conflicts, exercise };

  if (conflicts.length) {
    const alts = safeAlternatives(exercise, client, allExercises);
    return {
      ...base,
      kind: 'caution',
      why: `Flagged for this client's ${conflicts.join(', ').replace(/_/g, ' ')} issue. Consider a swap.`,
      switchTo: alts[0] || null,
      alternatives: alts,
    };
  }

  // No history → conservative starting prescription.
  if (!hist.length) {
    if (exercise.load === 'time')
      return { ...base, kind: 'start', sets: 3, seconds: 30, why: 'First time — start with 3 holds/rounds of ~30s and adjust to form.' };
    if (exercise.load === 'bodyweight')
      return { ...base, kind: 'start', sets: 3, reps: lo, why: `First time — 3×${lo}, add reps as form allows.` };
    return { ...base, kind: 'start', sets: 3, reps: lo, weight: null, why: `First time — find a weight for 3×${lo} at RPE ≤ 7 (2–3 reps left in the tank).` };
  }

  const last = hist[0];
  const rpe = avgRPE(last.sets);
  const w = topWeight(last.sets);
  const allAtTop = last.sets.every((s) => (Number(s.reps) || 0) >= hi);
  const nSets = Math.min(Math.max(last.sets.length, 2), 5);

  // Timed exercises: extend time, then progress the chain at 60s+.
  if (exercise.load === 'time') {
    const best = Math.max(...last.sets.map((s) => Number(s.seconds || s.reps) || 0));
    if (best >= 60) {
      const next = progressionOf(exercise, allExercises, client);
      if (next) return { ...base, kind: 'progress-exercise', switchTo: next, sets: nSets, seconds: 30, why: `Held ${best}s — time to progress to ${next.name}.` };
    }
    return { ...base, kind: 'progress', sets: nSets, seconds: Math.min(best + 10, 90), why: `Last best ${best}s — add ~10s.` };
  }

  // Bodyweight: add reps; two sessions at the ceiling → progress the chain.
  if (exercise.load === 'bodyweight') {
    const ceil = Math.max(hi, 12);
    const hitCeil = (h) => h.sets.every((s) => (Number(s.reps) || 0) >= ceil);
    if (hitCeil(last) && hist[1] && hitCeil(hist[1])) {
      const next = progressionOf(exercise, allExercises, client);
      if (next) return { ...base, kind: 'progress-exercise', switchTo: next, sets: 3, reps: lo, why: `Two sessions at ${nSets}×${ceil}+ — ready to progress to ${next.name}.` };
    }
    return { ...base, kind: 'progress', sets: nSets, reps: Math.min(minReps(last.sets) + 1, ceil), why: `Last: ${fmtSets(last.sets)}. Add a rep per set (ceiling ${ceil}).` };
  }

  // External load: double progression.
  if (rpe !== null && rpe >= 9.5) {
    const reg = regressionOf(exercise, allExercises, client);
    return {
      ...base, kind: 'deload', sets: nSets, reps: lo,
      weight: roundToIncrement(w * 0.9, units, exercise.region),
      switchTo: null, regression: reg || null,
      why: `Last session averaged RPE ${rpe.toFixed(1)} (very hard). Drop ~10% and rebuild${reg ? `, or regress to ${reg.name}` : ''}.`,
    };
  }
  if (allAtTop && (rpe === null || rpe <= 8.5)) {
    const bump = exercise.region === 'lower' ? 1.05 : 1.025;
    const nw = roundToIncrement(w * bump, units, exercise.region);
    return {
      ...base, kind: 'progress', sets: nSets, reps: lo,
      weight: nw > w ? nw : roundToIncrement(w + (units === 'kg' ? 1.25 : 2.5), units, exercise.region),
      why: `Hit ${nSets}×${hi} at ${w}${units}${rpe ? ` (RPE ${rpe.toFixed(1)})` : ''} — add load, reset to ${lo} reps.`,
    };
  }
  return {
    ...base, kind: 'hold', sets: nSets, reps: Math.min(minReps(last.sets) + 1, hi), weight: w,
    why: `Last: ${fmtSets(last.sets)} @ ${w}${units}. Keep the weight, push toward ${nSets}×${hi}.`,
  };
}

export function fmtSets(sets) {
  return sets.map((s) => `${s.reps || s.seconds || 0}${s.seconds ? 's' : ''}${s.weight ? '@' + s.weight : ''}`).join(', ');
}

export function fmtRec(rec, units) {
  if (!rec) return '';
  if (rec.kind === 'caution') return rec.why;
  const parts = [];
  if (rec.sets) parts.push(`${rec.sets} sets`);
  if (rec.reps) parts.push(`× ${rec.reps} reps`);
  if (rec.seconds) parts.push(`× ${rec.seconds}s`);
  if (rec.weight) parts.push(`@ ${rec.weight} ${units}`);
  return parts.join(' ');
}

// Body-comp series for charts, from InBody assessments.
export function inbodySeries(assessments, field) {
  return assessments
    .filter((a) => a.type === 'inbody' && a.data && a.data[field] != null && a.data[field] !== '')
    .map((a) => ({ x: a.date, y: Number(a.data[field]) }))
    .filter((p) => !isNaN(p.y))
    .sort((a, b) => a.x.localeCompare(b.x));
}
