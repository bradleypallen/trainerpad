// Seed exercise library.
// Each pattern is a progression chain: level 1 = easiest regression,
// higher level = harder progression. `load`: 'external' (weighted),
// 'bodyweight' (progress by reps then move up the chain), 'time' (seconds).
// `contra`: injury tags that make this exercise a caution for a client.
// `region`: 'upper' | 'lower' | 'core' — drives weight-increment size.

export const INJURY_TAGS = [
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'elbow', label: 'Elbow' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'neck', label: 'Neck' },
  { id: 'lower_back', label: 'Lower back' },
  { id: 'hip', label: 'Hip' },
  { id: 'knee', label: 'Knee' },
  { id: 'ankle', label: 'Ankle' },
];

export const PATTERNS = [
  { id: 'squat', label: 'Squat' },
  { id: 'hinge', label: 'Hinge' },
  { id: 'lunge', label: 'Lunge / single-leg' },
  { id: 'push_h', label: 'Horizontal push' },
  { id: 'push_v', label: 'Vertical push' },
  { id: 'pull_h', label: 'Horizontal pull' },
  { id: 'pull_v', label: 'Vertical pull' },
  { id: 'core', label: 'Core' },
  { id: 'carry', label: 'Carry' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'stretch', label: 'Stretches' },
];

const E = (id, name, pattern, level, load, region, contra, cue) => ({
  id, name, pattern, level, load, region, contra, cue, seed: true,
});

// Stretches: load 'stretch', never join a progression chain (all level 1,
// own pattern). `targets` = the movement patterns this stretch preps (dynamic,
// warm-up) or cools down (static).
const S = (id, name, stretchType, targets, region, contra, cue) => ({
  id, name, pattern: 'stretch', level: 1, load: 'stretch', stretchType, targets, region, contra, cue, seed: true,
});

export const SEED_EXERCISES = [
  // ---- Squat chain ----
  E('sq1', 'Box squat (bodyweight)', 'squat', 1, 'bodyweight', 'lower', ['knee'], 'Sit back to box, stand tall'),
  E('sq2', 'Bodyweight squat', 'squat', 2, 'bodyweight', 'lower', ['knee'], 'Full depth, knees track toes'),
  E('sq3', 'Goblet squat', 'squat', 3, 'external', 'lower', ['knee'], 'Elbows inside knees at bottom'),
  E('sq4', 'Dumbbell front squat', 'squat', 4, 'external', 'lower', ['knee'], 'DBs at shoulders'),
  E('sq5', 'Barbell back squat', 'squat', 5, 'external', 'lower', ['knee', 'lower_back'], 'Brace, big air, drive through midfoot'),
  E('sq6', 'Barbell front squat', 'squat', 6, 'external', 'lower', ['knee', 'wrist'], 'Elbows high'),

  // ---- Hinge chain ----
  E('hg1', 'Glute bridge', 'hinge', 1, 'bodyweight', 'lower', [], 'Squeeze at top, ribs down'),
  E('hg2', 'Hip hinge w/ dowel', 'hinge', 2, 'bodyweight', 'lower', [], 'Dowel stays on head, back, tailbone'),
  E('hg3', 'Kettlebell deadlift', 'hinge', 3, 'external', 'lower', ['lower_back'], 'Push floor away'),
  E('hg4', 'Romanian deadlift (DB)', 'hinge', 4, 'external', 'lower', ['lower_back'], 'Soft knees, hips back'),
  E('hg5', 'Trap-bar deadlift', 'hinge', 5, 'external', 'lower', ['lower_back'], 'Neutral spine, stand tall'),
  E('hg6', 'Barbell deadlift', 'hinge', 6, 'external', 'lower', ['lower_back'], 'Bar tight to shins'),
  E('hg7', 'Hip thrust (barbell)', 'hinge', 4, 'external', 'lower', [], 'Chin tucked, full lockout'),
  E('hg8', 'Kettlebell swing', 'hinge', 5, 'external', 'lower', ['lower_back'], 'Snap hips, arms relaxed'),

  // ---- Lunge / single-leg chain ----
  E('lg1', 'Split squat (supported)', 'lunge', 1, 'bodyweight', 'lower', ['knee'], 'Hold support, drop straight down'),
  E('lg2', 'Split squat', 'lunge', 2, 'bodyweight', 'lower', ['knee'], 'Front knee over midfoot'),
  E('lg3', 'Reverse lunge', 'lunge', 3, 'bodyweight', 'lower', ['knee'], 'Step back, torso tall'),
  E('lg4', 'Goblet reverse lunge', 'lunge', 4, 'external', 'lower', ['knee'], ''),
  E('lg5', 'Walking lunge (DB)', 'lunge', 5, 'external', 'lower', ['knee', 'ankle'], ''),
  E('lg6', 'Bulgarian split squat', 'lunge', 6, 'external', 'lower', ['knee', 'hip'], 'Rear foot elevated'),
  E('lg7', 'Step-up (DB)', 'lunge', 4, 'external', 'lower', ['knee'], 'Drive through whole foot'),

  // ---- Horizontal push chain ----
  E('ph1', 'Wall push-up', 'push_h', 1, 'bodyweight', 'upper', ['shoulder', 'wrist'], ''),
  E('ph2', 'Incline push-up', 'push_h', 2, 'bodyweight', 'upper', ['shoulder', 'wrist'], 'Hands on bench'),
  E('ph3', 'Push-up', 'push_h', 3, 'bodyweight', 'upper', ['shoulder', 'wrist'], 'Body one straight line'),
  E('ph4', 'DB bench press', 'push_h', 4, 'external', 'upper', ['shoulder'], ''),
  E('ph5', 'Barbell bench press', 'push_h', 5, 'external', 'upper', ['shoulder'], 'Feet planted, slight arch'),
  E('ph6', 'DB incline press', 'push_h', 5, 'external', 'upper', ['shoulder'], '30–45° bench'),

  // ---- Vertical push chain ----
  E('pv1', 'Landmine press (tall kneeling)', 'push_v', 1, 'external', 'upper', ['shoulder'], 'Shoulder-friendly angle'),
  E('pv2', 'Landmine press (standing)', 'push_v', 2, 'external', 'upper', ['shoulder'], ''),
  E('pv3', 'Seated DB shoulder press', 'push_v', 3, 'external', 'upper', ['shoulder', 'neck'], ''),
  E('pv4', 'Standing DB shoulder press', 'push_v', 4, 'external', 'upper', ['shoulder', 'neck', 'lower_back'], ''),
  E('pv5', 'Barbell overhead press', 'push_v', 5, 'external', 'upper', ['shoulder', 'neck', 'lower_back'], 'Glutes tight, ribs down'),

  // ---- Horizontal pull chain ----
  E('rh1', 'Seated cable row', 'pull_h', 2, 'external', 'upper', [], 'Chest up, squeeze blades'),
  E('rh2', 'Chest-supported DB row', 'pull_h', 3, 'external', 'upper', [], 'No lower-back load'),
  E('rh3', 'Single-arm DB row', 'pull_h', 4, 'external', 'upper', ['lower_back'], 'Flat back on bench'),
  E('rh4', 'Inverted row', 'pull_h', 4, 'bodyweight', 'upper', ['shoulder', 'elbow'], 'Lower bar = harder'),
  E('rh5', 'Barbell bent-over row', 'pull_h', 5, 'external', 'upper', ['lower_back'], 'Hinge and hold'),
  E('rh6', 'Band pull-apart', 'pull_h', 1, 'bodyweight', 'upper', [], 'Great warm-up / shoulder health'),

  // ---- Vertical pull chain ----
  E('pu1', 'Lat pulldown', 'pull_v', 2, 'external', 'upper', ['shoulder'], ''),
  E('pu2', 'Band-assisted pull-up', 'pull_v', 3, 'bodyweight', 'upper', ['shoulder', 'elbow'], ''),
  E('pu3', 'Negative pull-up', 'pull_v', 4, 'bodyweight', 'upper', ['shoulder', 'elbow'], '3–5s lower'),
  E('pu4', 'Pull-up', 'pull_v', 5, 'bodyweight', 'upper', ['shoulder', 'elbow'], 'Chin over bar'),
  E('pu5', 'Weighted pull-up', 'pull_v', 6, 'external', 'upper', ['shoulder', 'elbow'], ''),

  // ---- Core chain ----
  E('co1', 'Dead bug', 'core', 1, 'bodyweight', 'core', [], 'Low back stays down'),
  E('co2', 'Front plank', 'core', 2, 'time', 'core', ['shoulder'], 'Squeeze glutes'),
  E('co3', 'Side plank', 'core', 3, 'time', 'core', ['shoulder'], ''),
  E('co4', 'Pallof press', 'core', 3, 'external', 'core', [], 'Resist rotation'),
  E('co5', 'Ab-wheel rollout (knees)', 'core', 4, 'bodyweight', 'core', ['lower_back', 'shoulder'], ''),
  E('co6', 'Hanging knee raise', 'core', 5, 'bodyweight', 'core', ['shoulder'], ''),

  // ---- Carry chain ----
  E('ca1', 'Farmer carry (two hands)', 'carry', 2, 'external', 'core', [], 'Tall posture, quick steps'),
  E('ca2', 'Suitcase carry (one hand)', 'carry', 3, 'external', 'core', ['lower_back'], 'Don’t lean'),
  E('ca3', 'Overhead carry', 'carry', 4, 'external', 'upper', ['shoulder', 'neck'], ''),

  // ---- Conditioning ----
  E('cn1', 'Incline treadmill walk', 'conditioning', 1, 'time', 'lower', [], 'Zone 2'),
  E('cn2', 'Bike intervals', 'conditioning', 2, 'time', 'lower', [], ''),
  E('cn3', 'Rower intervals', 'conditioning', 3, 'time', 'lower', ['lower_back'], ''),
  E('cn4', 'Sled push', 'conditioning', 3, 'external', 'lower', [], 'Knee-friendly power work'),
  E('cn5', 'Battle ropes', 'conditioning', 2, 'time', 'upper', ['shoulder'], ''),

  // ---- Stretches (no progression chain; `targets` = patterns they prep/cool) ----
  S('st_d1', 'Leg swings', 'dynamic', ['hinge', 'lunge', 'squat'], 'lower', ['hip'], 'Hold support, swing loose'),
  S('st_d2', 'Walking lunge with twist', 'dynamic', ['lunge', 'squat', 'core'], 'lower', ['knee'], 'Rotate over the front leg'),
  S('st_d3', 'Arm circles', 'dynamic', ['push_h', 'push_v', 'pull_h', 'pull_v'], 'upper', [], 'Small to large, both directions'),
  S('st_d4', 'Cat-cow', 'dynamic', ['core', 'hinge'], 'core', [], 'Segment the spine slowly'),
  S('st_d5', "World's greatest stretch", 'dynamic', ['lunge', 'hinge', 'push_h'], 'lower', ['knee'], 'Long lunge, reach to the ceiling'),
  S('st_d6', 'Inchworm', 'dynamic', ['hinge', 'push_h', 'core'], 'core', ['wrist', 'shoulder', 'lower_back'], 'Walk hands out, heels down'),
  S('st_d7', '90/90 hip switches', 'dynamic', ['squat', 'hinge', 'lunge'], 'lower', ['hip', 'knee'], 'Knees sweep side to side'),
  S('st_d8', 'Shoulder pass-throughs (band)', 'dynamic', ['push_v', 'pull_v', 'push_h'], 'upper', ['shoulder'], 'Wide grip, straight arms'),
  S('st_s1', 'Standing quad stretch', 'static', ['squat', 'lunge'], 'lower', ['knee'], 'Knees together, tuck the pelvis'),
  S('st_s2', 'Hamstring stretch (strap)', 'static', ['hinge'], 'lower', ['lower_back'], 'Hinge from the hips, soft knee'),
  S('st_s3', 'Figure-4 piriformis stretch', 'static', ['squat', 'hinge', 'lunge'], 'lower', ['hip'], 'Ankle over knee, sit back'),
  S('st_s4', 'Kneeling hip-flexor stretch', 'static', ['lunge', 'hinge'], 'lower', ['knee'], 'Squeeze the glute, ribs down'),
  S('st_s5', 'Doorway chest stretch', 'static', ['push_h', 'push_v'], 'upper', ['shoulder'], 'Elbow at 90°, step through'),
  S('st_s6', "Child's pose lat stretch", 'static', ['pull_v', 'pull_h'], 'upper', ['knee', 'shoulder'], 'Hips back, reach long'),
  S('st_s7', 'Calf stretch (wall)', 'static', ['lunge', 'conditioning'], 'lower', ['ankle'], 'Back heel down, leg straight'),
  S('st_s8', 'Upper-trap neck stretch', 'static', ['carry', 'pull_v'], 'upper', ['neck'], 'Ear to shoulder, gentle pull'),
];

// InBody fields the assessment form captures (manual entry from the printout).
export const INBODY_FIELDS = [
  { id: 'weight', label: 'Weight', unitL: 'lb', unitK: 'kg' },
  { id: 'smm', label: 'Skeletal muscle mass', unitL: 'lb', unitK: 'kg' },
  { id: 'bfm', label: 'Body fat mass', unitL: 'lb', unitK: 'kg' },
  { id: 'pbf', label: 'Body fat %', unitL: '%', unitK: '%' },
  { id: 'bmi', label: 'BMI', unitL: '', unitK: '' },
  { id: 'vfl', label: 'Visceral fat level', unitL: '', unitK: '' },
  { id: 'bmr', label: 'BMR', unitL: 'kcal', unitK: 'kcal' },
];

// Common fitness-assessment tests (free-form ones can be added too).
export const FITNESS_TESTS = [
  { id: 'pushups', label: 'Push-up test (max reps)', unit: 'reps' },
  { id: 'squats60', label: 'Squat test (reps in 60s)', unit: 'reps' },
  { id: 'plank', label: 'Plank hold', unit: 'sec' },
  { id: 'sitreach', label: 'Sit-and-reach', unit: 'in' },
  { id: 'rhr', label: 'Resting heart rate', unit: 'bpm' },
  { id: 'mile', label: '1-mile walk/run', unit: 'min' },
];

export const GOALS = [
  { id: 'general', label: 'General fitness', reps: [8, 12] },
  { id: 'strength', label: 'Strength', reps: [4, 6] },
  { id: 'hypertrophy', label: 'Muscle gain', reps: [8, 12] },
  { id: 'endurance', label: 'Endurance / toning', reps: [12, 20] },
  { id: 'weightloss', label: 'Weight loss', reps: [10, 15] },
];

// NASM OPT model phases — an optional per-client "micro goal" that refines
// the rep range within the primary goal. When set, it wins over GOALS.reps.
// Parameters follow the NASM OPT resistance-training table: reps, working
// sets, tempo, and rest between sets.
export const PHASES = [
  { id: 'stabilization', label: 'Stabilization Endurance', reps: [12, 20], sets: '1–3', tempo: '4-2-1 slow', rest: '0–90s', note: 'OPT 1 — slow tempo, control, build a base (50–70%)' },
  { id: 'strength_endurance', label: 'Strength Endurance', reps: [8, 12], sets: '2–4', tempo: '2-0-2', rest: '0–60s', note: 'OPT 2 — superset strength + stabilization (70–80%)' },
  { id: 'hypertrophy', label: 'Hypertrophy', reps: [6, 12], sets: '3–5', tempo: '2-0-2', rest: '0–60s', note: 'OPT 3 — volume for muscle growth (75–85%)' },
  { id: 'max_strength', label: 'Maximum Strength', reps: [1, 5], sets: '4–6', tempo: 'x-x-x', rest: '3–5 min', note: 'OPT 4 — heavy loads, full rest (85–100%)' },
  { id: 'power', label: 'Power', reps: [8, 10], sets: '3–5', tempo: 'x-x-x explosive', rest: '1–2 min between pairs', note: 'OPT 5 — superset: heavy strength (1–5 @ 85–100%) + light explosive (8–10 @ 30–45% / 10% BW)' },
];
