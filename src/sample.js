// Optional demo data so the app can be explored before real clients are added.
import { uid, put } from './db.js';

export async function loadSampleData() {
  const today = new Date();
  const iso = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const maria = {
    id: uid(), name: 'Maria Santos', goal: 'strength', phase: 'max_strength', sex: 'F',
    dob: '1988-04-12', email: 'maria@example.com', phone: '555-0142',
    injuries: [], injuryNotes: '', notes: 'Training for a powerlifting meet in fall. Prefers morning sessions.',
    createdAt: iso(70),
  };
  const james = {
    id: uid(), name: 'James Okafor', goal: 'weightloss', activity: 'moderate', sex: 'M',
    dob: '1975-09-30', email: 'james@example.com', phone: '555-0177',
    injuries: ['knee'], injuryNotes: 'Left knee meniscus repair (2023). Building back knee-friendly lower-body work; progress squatting patterns cautiously.',
    notes: 'Goal: lose 25 lb before daughter’s wedding in November.',
    createdAt: iso(56),
  };
  await put('clients', maria);
  await put('clients', james);

  // Maria: 8 weeks of progressing strength work.
  const mariaWeeks = [
    { d: 56, sq: [95, 8], bp: [65, 8], row: [30, 10] },
    { d: 49, sq: [95, 10], bp: [65, 10], row: [30, 12] },
    { d: 42, sq: [95, 12], bp: [70, 8], row: [35, 10] },
    { d: 35, sq: [105, 8], bp: [70, 10], row: [35, 12] },
    { d: 28, sq: [105, 10], bp: [70, 12], row: [40, 10] },
    { d: 21, sq: [105, 12], bp: [75, 8], row: [40, 12] },
    { d: 14, sq: [115, 8], bp: [75, 10], row: [45, 10] },
    { d: 7, sq: [115, 10], bp: [75, 12], row: [45, 12] },
  ];
  for (const w of mariaWeeks) {
    await put('sessions', {
      id: uid(), clientId: maria.id, date: iso(w.d),
      notes: '', entries: [
        { exerciseId: 'sq5', sets: [0, 1, 2].map(() => ({ weight: w.sq[0], reps: w.sq[1], rpe: 7.5 })) },
        { exerciseId: 'ph4', sets: [0, 1, 2].map(() => ({ weight: w.bp[0], reps: w.bp[1], rpe: 8 })) },
        { exerciseId: 'rh3', sets: [0, 1, 2].map(() => ({ weight: w.row[0], reps: w.row[1], rpe: 7 })) },
      ],
    });
  }

  // James: knee-friendly work, 6 weeks (hip thrust, chest-supported row, plank).
  const jamesWeeks = [
    { d: 42, ht: [65, 10], row: [30, 10], pl: 25 },
    { d: 35, ht: [65, 12], row: [30, 12], pl: 30 },
    { d: 28, ht: [75, 10], row: [35, 10], pl: 35 },
    { d: 21, ht: [75, 12], row: [35, 12], pl: 45 },
    { d: 14, ht: [85, 10], row: [40, 10], pl: 50, readiness: 'low' }, // slept badly that week — shows the readiness feature
    { d: 7, ht: [85, 12], row: [40, 12], pl: 60 },
  ];
  for (const w of jamesWeeks) {
    await put('sessions', {
      id: uid(), clientId: james.id, date: iso(w.d),
      readiness: w.readiness || 'normal',
      notes: '', entries: [
        { exerciseId: 'hg7', sets: [0, 1, 2].map(() => ({ weight: w.ht[0], reps: w.ht[1], rpe: 7 })) },
        { exerciseId: 'rh2', sets: [0, 1, 2].map(() => ({ weight: w.row[0], reps: w.row[1], rpe: 7.5 })) },
        { exerciseId: 'co2', sets: [0, 1].map(() => ({ seconds: w.pl, rpe: 7 })) },
      ],
    });
  }

  // InBody entries.
  const jamesInbody = [
    { d: 56, weight: 228.4, smm: 82.1, bfm: 72.3, pbf: 31.7, bmi: 31.0, vfl: 14, bmr: 2050 },
    { d: 28, weight: 221.9, smm: 82.8, bfm: 65.9, pbf: 29.7, bmi: 30.1, vfl: 13, bmr: 2061 },
    { d: 2, weight: 216.5, smm: 83.4, bfm: 60.2, pbf: 27.8, bmi: 29.4, vfl: 12, bmr: 2070 },
  ];
  for (const r of jamesInbody) {
    const { d, ...data } = r;
    await put('assessments', { id: uid(), clientId: james.id, date: iso(d), type: 'inbody', data, notes: '' });
  }
  const mariaInbody = [
    { d: 63, weight: 142.0, smm: 62.4, bfm: 33.5, pbf: 23.6, bmi: 22.9, vfl: 5, bmr: 1420 },
    { d: 7, weight: 144.6, smm: 64.8, bfm: 32.4, pbf: 22.4, bmi: 23.3, vfl: 5, bmr: 1448 },
  ];
  for (const r of mariaInbody) {
    const { d, ...data } = r;
    await put('assessments', { id: uid(), clientId: maria.id, date: iso(d), type: 'inbody', data, notes: '' });
  }

  await put('assessments', {
    id: uid(), clientId: james.id, date: iso(42), type: 'fitness',
    data: { pushups: 12, plank: 25, rhr: 78 }, notes: 'Baseline.',
  });
  await put('assessments', {
    id: uid(), clientId: james.id, date: iso(2), type: 'fitness',
    data: { pushups: 19, plank: 60, rhr: 71 }, notes: 'Nice improvement across the board.',
  });

  // Overhead squat screen — feeds the Corrective tab in the demo.
  await put('assessments', {
    id: uid(), clientId: james.id, date: iso(10), type: 'ohs',
    data: { knees_in: true, forward_lean: true },
    notes: 'Knees cave on reps 3–5, forward lean throughout. Shoes off. Retest in 4 weeks.',
  });

  return { clients: 2 };
}
