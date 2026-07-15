// Recommendation engine — transparent, rule-based strength-coaching heuristics.
// Every recommendation carries a `why` string so the trainer can sanity-check it.

import { GOALS, PHASES, PATTERNS, OHS_COMPENSATIONS, ACTIVITY_LEVELS } from './seed.js';

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

const NON_CHAIN = new Set(['corrective', 'acc_upper', 'acc_lower']); // patterns that never join a progression chain
function chainNeighbor(exercise, allExercises, dir, client) {
  if (exercise.load === 'stretch' || NON_CHAIN.has(exercise.pattern)) return undefined; // stretches, correctives & accessories don't progress
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
  const phaseWhy = phase ? ` ${phase.label} phase: ${lo}–${hi} reps, ${phase.sets} sets, ${phase.tempo} tempo, rest ${phase.rest}.` : '';
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

  // No history → conservative starting prescription. Never start a new
  // exercise below 3 reps, even in a 1-rep-capable phase like Max Strength.
  const startReps = Math.max(lo, 3);
  if (!hist.length) {
    if (exercise.load === 'time')
      return { ...base, kind: 'start', sets: 3, seconds: 30, why: 'First time — start with 3 holds/rounds of ~30s and adjust to form.' };
    if (exercise.load === 'bodyweight')
      return { ...base, kind: 'start', sets: 3, reps: startReps, why: `First time — 3×${startReps}, add reps as form allows.${phaseWhy}` };
    return { ...base, kind: 'start', sets: 3, reps: startReps, weight: null, why: `First time — find a weight for 3×${startReps} at RPE ≤ 7 (2–3 reps left in the tank).${phaseWhy}` };
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

// ---- Overhead squat assessment → corrective work ----
export function latestOHS(assessments) {
  return assessments.filter((a) => a.type === 'ohs')
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

// Turn the latest overhead-squat screen into corrective recommendations.
// Every rec keeps a plain-English `why`. Injury-flagged exercises are
// excluded but *named*, so the trainer knows the plan was trimmed and why.
export function correctiveRecs(assessments, exercises, client) {
  const assessment = latestOHS(assessments);
  if (!assessment) return { assessment: null, recs: [] };
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const resolve = (ids) => {
    const kept = [], excluded = [];
    for (const id of ids || []) {
      const ex = exById[id];
      if (!ex) continue;
      (injuryConflicts(ex, client).length ? excluded : kept).push(ex);
    }
    return { kept, excluded };
  };
  const recs = [];
  for (const comp of OHS_COMPENSATIONS) {
    if (!assessment.data || !assessment.data[comp.id]) continue;
    const flex = resolve(comp.flexIds);
    const str = resolve(comp.strengthIds);
    recs.push({
      comp,
      flexibility: flex.kept,
      strengthen: str.kept,
      excluded: [...flex.excluded, ...str.excluded],
      why: `${comp.label} usually points to overactive ${comp.overactive.join(', ')} and underactive ${comp.underactive.join(', ')} — foam-roll/stretch what's probably tight, then activate what's probably weak.`,
    });
  }
  return { assessment, recs };
}

// ---- Nutrition (rule-based, from the latest InBody) ----
export function latestInBody(assessments) {
  return assessments.filter((a) => a.type === 'inbody')
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

const LB_PER_KG = 2.2046;
// Numeric thresholds live in logic.js, not seed.js.
const GOAL_CAL_ADJ = { weightloss: 0.80, hypertrophy: 1.10, strength: 1.05, general: 1.00, endurance: 1.00 };
const GOAL_PROTEIN_GKG = { weightloss: 2.0, hypertrophy: 1.8, strength: 1.8, general: 1.6, endurance: 1.6 };
const round50 = (x) => Math.round(x / 50) * 50;
const round5 = (x) => Math.round(x / 5) * 5;

export const NUTRITION_DISCLAIMER =
  'General guidance for healthy adults, computed from standard formulas — not medical or dietetic advice. ' +
  'For clients with medical conditions, a history of disordered eating, or who are pregnant or nursing, refer to a registered dietitian or physician.';

export function nutritionRecs({ client, assessments, units }) {
  const latest = latestInBody(assessments);
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const d = (latest && latest.data) || {};
  const weightRaw = num(d.weight);
  const weightKg = weightRaw != null ? (units === 'lb' ? weightRaw / LB_PER_KG : weightRaw) : null;
  const measuredBmr = num(d.bmr), pbf = num(d.pbf), bfmRaw = num(d.bfm);

  if (!latest || weightKg == null || (measuredBmr == null && pbf == null && bfmRaw == null)) {
    return { ok: false, missing: 'Add an InBody entry with weight plus BMR or body-fat % — the numbers here are computed from real measurements, not population averages.' };
  }

  // BMR: prefer the machine's measurement; else Katch-McArdle from lean mass.
  let bmr, bmrSource, bmrWhy;
  if (measuredBmr != null) {
    bmr = Math.round(measuredBmr);
    bmrSource = 'InBody measurement';
    bmrWhy = `Resting burn ${bmr} kcal — measured by the InBody scan; what the body uses at complete rest.`;
  } else {
    const lbmKg = pbf != null ? weightKg * (1 - pbf / 100)
      : weightKg - (units === 'lb' ? bfmRaw / LB_PER_KG : bfmRaw);
    bmr = Math.round(370 + 21.6 * lbmKg);
    bmrSource = 'estimated from lean mass (Katch-McArdle)';
    bmrWhy = `Resting burn ~${bmr} kcal, estimated from lean mass (Katch-McArdle: 370 + 21.6 × ${Math.round(lbmKg * 10) / 10} kg lean). Lean tissue drives resting burn, so this beats weight-only formulas.`;
  }

  // Activity: stored on the client, else assume lightly active.
  const actId = client.activity;
  const act = ACTIVITY_LEVELS.find((a) => a.id === actId) || ACTIVITY_LEVELS.find((a) => a.id === 'light');
  const tdee = Math.round(bmr * act.factor);
  const tdeeWhy = `Daily burn ~${tdee} kcal = resting burn × ${act.factor} (${act.label.toLowerCase()}: ${act.desc.toLowerCase()}).`
    + (actId ? '' : ' No activity level set — assuming lightly active; tap a chip above to refine.');

  // Goal adjustment, clamped so a cut never goes below BMR.
  const adj = GOAL_CAL_ADJ[client.goal] != null ? GOAL_CAL_ADJ[client.goal] : 1.0;
  let rawCals = tdee * adj, clamped = false;
  if (adj < 1 && rawCals < bmr) { rawCals = bmr; clamped = true; }
  const calories = round50(rawCals);
  const calWhys = {
    weightloss: 'About 20% below daily burn — steady fat loss (~0.5–1% of body weight per week) without tanking energy or training quality.',
    hypertrophy: 'About 10% above daily burn — enough surplus to build muscle while keeping fat gain minimal.',
    strength: 'A small ~5% surplus to support heavy training and recovery.',
    general: 'At maintenance — fuel training without moving body weight.',
    endurance: 'At maintenance — fuel training without moving body weight.',
  };
  const caloriesWhy = `Target ${calories} kcal/day. ` + (calWhys[client.goal] || calWhys.general)
    + (clamped ? ' Capped at the resting burn — eating below BMR is not sustainable or safe to coach.' : '');

  // Macros: protein by g/kg bodyweight, fat 30% of calories, carbs fill the rest.
  const gkg = GOAL_PROTEIN_GKG[client.goal] != null ? GOAL_PROTEIN_GKG[client.goal] : 1.6;
  const protein = round5(weightKg * gkg);
  const fat = round5((calories * 0.30) / 9);
  const carbs = round5(Math.max(0, calories - protein * 4 - fat * 9) / 4);
  const proteinWhys = {
    weightloss: 'set high to protect muscle while in a deficit',
    hypertrophy: 'the raw material for new muscle',
    strength: 'supports recovery from heavy loading',
    general: 'enough to maintain and repair muscle',
    endurance: 'enough to maintain and repair muscle',
  };
  const macrosWhy = `Protein ${protein} g = ${gkg} g per kg of body weight — ${proteinWhys[client.goal] || proteinWhys.general}. `
    + `Fat ${fat} g ≈ 30% of calories — hormones and satiety. Carbs ${carbs} g fill the remaining calories — the main training fuel.`;

  return {
    ok: true, bmr, bmrSource, tdee, calories, protein, fat, carbs,
    activityId: act.id, date: latest.date,
    whys: { bmr: bmrWhy, tdee: tdeeWhy, calories: caloriesWhy, macros: macrosWhy },
    disclaimer: NUTRITION_DISCLAIMER,
  };
}

// ONE generic example day — an illustration of what the calorie/protein
// targets look like as food, not a meal plan. Hand-portion phrasing on purpose.
const MEAL_SPLIT = [
  { label: 'Breakfast', frac: 0.25, note: 'palm of protein, fist of carbs, thumb of fats' },
  { label: 'Lunch', frac: 0.30, note: 'palm of protein, fist of carbs, fist of veg' },
  { label: 'Snack', frac: 0.15, note: 'protein-forward — yogurt, shake, or handful of nuts' },
  { label: 'Dinner', frac: 0.30, note: 'palm of protein, fist of carbs, fist of veg, thumb of fats' },
];
export function exampleDay(calories, protein) {
  return MEAL_SPLIT.map((m) => ({
    label: m.label,
    kcal: Math.round((calories * m.frac) / 10) * 10,
    protein: round5(protein * m.frac),
    note: m.note,
  }));
}

// Body-comp series for charts, from InBody assessments.
export function inbodySeries(assessments, field) {
  return assessments
    .filter((a) => a.type === 'inbody' && a.data && a.data[field] != null && a.data[field] !== '')
    .map((a) => ({ x: a.date, y: Number(a.data[field]) }))
    .filter((p) => !isNaN(p.y))
    .sort((a, b) => a.x.localeCompare(b.x));
}
