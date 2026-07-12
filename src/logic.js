// Recommendation engine — transparent, rule-based strength-coaching heuristics.
// Every recommendation carries a `why` string so the trainer can sanity-check it.

import { GOALS, PHASES, PATTERNS } from './seed.js';

export const epley1RM = (weight, reps) =>
  reps > 0 ? Math.round(weight * (1 + reps / 30) * 10) / 10 : 0;

export function repRangeFor(client) {
  // An OPT phase (micro goal), when set, refines the goal's rep range.
  const p = client && client.phase ? PHASES.find((x) => x.id === client.phase) : null;
  if (p) return p.reps;
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
        out.push({ date: s.date, sets: en.sets, readiness: s.readiness || 'normal' });
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
  if (exercise.load === 'stretch') return undefined; // stretches don't progress
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
// `readiness`: 'normal' | 'low' — 'low' (poor sleep / low energy today) eases
// the prescription via applyLowReadiness below.
export function recommend(exercise, client, sessions, allExercises, units, readiness = 'normal') {
  const rec = recommendCore(exercise, client, sessions, allExercises, units);
  return readiness === 'low' ? applyLowReadiness(rec, units) : rec;
}

// Uniform low-readiness easing: one fewer set, ~10% less load, never advance
// the chain today. Cautions and stretches pass through untouched.
function applyLowReadiness(rec, units) {
  if (!rec || rec.kind === 'caution' || rec.kind === 'stretch') return rec;
  const out = { ...rec };
  if (out.kind === 'progress-exercise') { out.kind = 'hold'; out.switchTo = null; }
  if (out.sets) out.sets = Math.max(2, out.sets - 1);
  if (out.weight) out.weight = roundToIncrement(out.weight * 0.9, units, rec.exercise.region);
  out.why = 'Low-readiness day: about 10% lighter and one fewer set — treat today as maintenance. ' + rec.why;
  return out;
}

function recommendCore(exercise, client, sessions, allExercises, units) {
  const conflicts = injuryConflicts(exercise, client);
  // Low-readiness sessions were deliberately light — they never count as
  // "last time" and can't read as regression.
  const hist = historyFor(sessions, exercise.id).filter((h) => h.readiness !== 'low');
  const [lo, hi] = repRangeFor(client);
  const phase = client && client.phase ? PHASES.find((p) => p.id === client.phase) : null;
  const phaseWhy = phase ? ` Rep range ${lo}–${hi} from the ${phase.label} phase.` : '';
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

  // Stretches: fixed easy prescription, no history/progression.
  if (exercise.load === 'stretch') {
    const t = (exercise.targets || []).map((id) => (PATTERNS.find((p) => p.id === id) || { label: id }).label).join(', ');
    return exercise.stretchType === 'dynamic'
      ? { ...base, kind: 'stretch', sets: 2, reps: 10, why: `Dynamic stretch — 2×10 controlled reps as a warm-up${t ? ' for ' + t.toLowerCase() : ''}.` }
      : { ...base, kind: 'stretch', sets: 2, seconds: 30, why: `Static stretch — 2×30s easy holds after training${t ? ' ' + t.toLowerCase() : ''}.` };
  }

  // No history → conservative starting prescription.
  if (!hist.length) {
    if (exercise.load === 'time')
      return { ...base, kind: 'start', sets: 3, seconds: 30, why: 'First time — start with 3 holds/rounds of ~30s and adjust to form.' };
    if (exercise.load === 'bodyweight')
      return { ...base, kind: 'start', sets: 3, reps: lo, why: `First time — 3×${lo}, add reps as form allows.${phaseWhy}` };
    return { ...base, kind: 'start', sets: 3, reps: lo, weight: null, why: `First time — find a weight for 3×${lo} at RPE ≤ 7 (2–3 reps left in the tank).${phaseWhy}` };
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
      why: `Hit ${nSets}×${hi} at ${w}${units}${rpe ? ` (RPE ${rpe.toFixed(1)})` : ''} — add load, reset to ${lo} reps.${phaseWhy}`,
    };
  }
  return {
    ...base, kind: 'hold', sets: nSets, reps: Math.min(minReps(last.sets) + 1, hi), weight: w,
    why: `Last: ${fmtSets(last.sets)} @ ${w}${units}. Keep the weight, push toward ${nSets}×${hi}.${phaseWhy}`,
  };
}

// ---- Warm-up / cooldown stretch suggestions ----
// Given the movement patterns being trained, pick dynamic stretches (before)
// and static stretches (after) whose `targets` overlap, skipping any the
// client's injury flags rule out.
export function stretchSuggestions(patternIds, exercises, client) {
  const wanted = new Set((patternIds || []).filter((p) => p && p !== 'stretch'));
  if (!wanted.size) return { dynamic: [], static: [], why: '' };
  const pick = (type) => exercises
    .filter((e) => e.load === 'stretch' && e.stretchType === type &&
      (e.targets || []).some((t) => wanted.has(t)) &&
      injuryConflicts(e, client).length === 0)
    .map((e) => ({ e, n: (e.targets || []).filter((t) => wanted.has(t)).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((x) => x.e);
  const labels = [...wanted].map((id) => (PATTERNS.find((p) => p.id === id) || { label: id }).label).join(', ');
  return {
    dynamic: pick('dynamic'),
    static: pick('static'),
    why: `Matched to the patterns being trained (${labels}) — dynamic before, static after. Injury-flagged stretches excluded.`,
  };
}

// ---- InBody sheet text parser (for iPadOS Live Text paste) ----
// Order matters twice: (1) fields are tried top-to-bottom per line, so
// specific multi-word labels win before short/generic ones — bare 'weight'
// is LAST because it appears inside 'Weight Control' / 'Ideal Weight' lines;
// (2) within a field, longer aliases come first. Matching is case-insensitive
// with word boundaries. NO regex lookbehind (Safari 15).
const INBODY_ALIASES = [
  { id: 'smm', aliases: ['skeletal muscle mass', 'smm'] },
  { id: 'bfm', aliases: ['body fat mass', 'bfm'] },
  { id: 'pbf', aliases: ['percent body fat', 'body fat percentage', 'pbf'] },
  { id: 'bmi', aliases: ['body mass index', 'bmi'] },
  { id: 'vfl', aliases: ['visceral fat level', 'visceral fat'] },
  { id: 'bmr', aliases: ['basal metabolic rate', 'bmr'] },
  { id: 'weight', aliases: ['weight'] },
];
const WEIGHT_BLOCKLIST = ['weight control', 'ideal weight', 'target weight', 'weight range'];

export function parseInBodyText(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    for (const f of INBODY_ALIASES) {
      if (out[f.id] != null) continue; // first match wins per field
      if (f.id === 'weight' && WEIGHT_BLOCKLIST.some((b) => lower.includes(b))) continue;
      let hit = null;
      for (const a of f.aliases) {
        const m = lower.match(new RegExp('\\b' + a + '\\b')); // aliases are [a-z ] only — no escaping needed
        if (m) { hit = m.index + a.length; break; }
      }
      if (hit === null) continue;
      const after = line.slice(hit);
      const num = after.match(/-?\d+(\.\d+)?/);
      if (!num) continue;
      if (after.slice(0, num.index).includes('~')) continue; // a '~' before the number means it's a range bound, not the value
      const v = Number(num[0]);
      if (!isNaN(v)) { out[f.id] = v; break; } // one field per line
    }
  }
  return out;
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
