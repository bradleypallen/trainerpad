// Shareable workout-card generator: pure model builders + a measure-then-draw
// canvas renderer + Web Share / download helpers. Dependency-free. Cards
// always render the LIGHT palette (hardcoded hexes below) so a texted card
// looks identical no matter the device theme. Imports from logic.js/seed.js
// only — app.jsx imports this module, never the reverse.
import { recommend, fmtRec, fmtSets, stretchSuggestions, correctiveRecs } from './logic.js';
import { GOALS, PHASES } from './seed.js';

const C = {
  accent: '#2a78d6', accentInk: '#ffffff', ink: '#0b0b0b', ink2: '#52514e',
  muted: '#898781', surface: '#fcfcfb', border: 'rgba(11,11,11,0.10)',
};
const FONT = (w, px) => `${w} ${px}px -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif`;

const goalLabel = (id) => (GOALS.find((g) => g.id === id) || {}).label || id || '';
const phaseLabel = (id) => (PHASES.find((p) => p.id === id) || {}).label || id || '';
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---- Model builders ----

export function buildHomeworkCard({ client, sessions, assessments, exercises, units, trainerName }) {
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const seen = [];
  for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const en of s.entries || []) if (!seen.includes(en.exerciseId)) seen.push(en.exerciseId);
  }
  const items = seen.slice(0, 10).map((id) => exById[id]).filter(Boolean);

  const phase = client.phase ? PHASES.find((p) => p.id === client.phase) : null;
  const metaLine = goalLabel(client.goal) +
    (phase ? ` · ${phase.label} phase — ${phase.sets} sets, rest ${phase.rest}` : '');

  const sections = [];
  const sg = stretchSuggestions([...new Set(items.map((e) => e.pattern))], exercises, client);
  if (sg.dynamic.length) sections.push({ heading: 'Warm-up — 2×10 each', lines: sg.dynamic.map((e) => ({ main: e.name })) });

  const main = [];
  for (const ex of items) {
    const rec = recommend(ex, client, sessions, exercises, units);
    if (rec.kind === 'stretch') continue;
    if (rec.kind === 'caution') {
      // A client's homework never prescribes a flagged movement — swap it.
      if (!rec.switchTo) continue;
      const swapRec = recommend(rec.switchTo, client, sessions, exercises, units);
      main.push({ main: `${rec.switchTo.name} — ${fmtRec(swapRec, units)}`, sub: `swapped in for ${ex.name} (safety)` });
    } else {
      main.push({ main: `${ex.name} — ${fmtRec(rec, units)}` });
    }
  }
  if (main.length) sections.push({ heading: 'Workout — suggested', lines: main.slice(0, 12) });

  if (sg.static.length) sections.push({ heading: 'Cooldown — 2×30s each', lines: sg.static.map((e) => ({ main: e.name })) });

  const { recs } = correctiveRecs(assessments || [], exercises, client);
  if (recs.length) sections.push({
    heading: 'Corrective focus',
    lines: recs.slice(0, 3).map((r) => ({
      main: r.comp.label,
      sub: r.strengthen.length ? 'Strengthen: ' + r.strengthen.slice(0, 2).map((e) => e.name).join(' · ') : undefined,
    })),
  });

  return {
    title: 'Workout plan', clientFirst: client.name.split(' ')[0],
    dateLabel: fmtDate(todayISO()), metaLine, trainerName: trainerName || '',
    sections, footer: 'Made with TrainerPad',
  };
}

export function buildSessionCard({ session, client, exercises, units, trainerName }) {
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const sections = [];
  const lines = (session.entries || []).map((en) => {
    const ex = exById[en.exerciseId] || { name: '(deleted exercise)' };
    const weighted = (en.sets || []).some((st) => st.weight);
    return {
      main: ex.name,
      sub: fmtSets(en.sets) + (weighted ? ' ' + units : '') + (en.notes ? ' — ' + en.notes : ''),
    };
  });
  if (lines.length) sections.push({ heading: 'Logged work', lines: lines.slice(0, 14) });
  if (session.readiness === 'low') {
    sections.push({ heading: 'Note', lines: [{ main: 'Low-energy day — went lighter on purpose. That’s the plan working.' }], wrap: true });
  }
  if (session.notes) sections.push({ heading: 'Session notes', lines: [{ main: session.notes }], wrap: true });

  return {
    title: 'Session record', clientFirst: client.name.split(' ')[0],
    dateLabel: fmtDate(session.date),
    metaLine: goalLabel(client.goal) + (client.phase ? ` · ${phaseLabel(client.phase)} phase` : ''),
    trainerName: trainerName || '', sections, footer: 'Made with TrainerPad',
  };
}

// ---- Canvas renderer (measure pass computes height, draw pass paints) ----

const W = 1080, L = 64, R = W - L, CW = R - L;

function roundRectPath(ctx, x, y, w, h, r) {
  // Safari 15 has no ctx.roundRect — draw the path manually.
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipsize(ctx, text, maxW) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function wrapText(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (!cur || ctx.measureText(cand).width <= maxW) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, kept[maxLines - 1] + ' …', maxW);
    return kept;
  }
  return lines;
}

function hairline(ctx, y) {
  ctx.fillStyle = C.border;
  ctx.fillRect(L, y, CW, 1);
}

function walk(model, ctx, draw) {
  let y = 150; // header band height
  if (draw) {
    ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, 150);
    roundRectPath(ctx, L, 44, 62, 62, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    ctx.fillStyle = C.accentInk; ctx.font = FONT(700, 30);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TP', L + 31, 76);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = FONT(600, 30); ctx.fillStyle = C.accentInk;
    ctx.fillText(ellipsize(ctx, model.trainerName || 'TrainerPad', 560), 150, 86);
    ctx.font = FONT(400, 26); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'right';
    ctx.fillText(model.dateLabel, R, 86);
    ctx.textAlign = 'left';
  }
  y += 88; // title baseline
  if (draw) {
    ctx.font = FONT(700, 52); ctx.fillStyle = C.ink;
    ctx.fillText(ellipsize(ctx, `${model.title} · ${model.clientFirst}`, CW), L, y);
  }
  if (model.metaLine) {
    y += 46;
    if (draw) {
      ctx.font = FONT(400, 28); ctx.fillStyle = C.ink2;
      ctx.fillText(ellipsize(ctx, model.metaLine, CW), L, y);
    }
  }
  y += 24;
  for (const sec of model.sections) {
    y += 52;
    if (draw) {
      ctx.font = FONT(700, 24); ctx.fillStyle = C.accent;
      ctx.fillText(sec.heading.toUpperCase(), L, y);
    }
    y += 16;
    if (draw) hairline(ctx, y);
    for (const line of sec.lines) {
      ctx.font = FONT(600, 28); // set before measuring (wrap/ellipsize use it)
      const mains = sec.wrap ? wrapText(ctx, line.main, CW, 3) : [ellipsize(ctx, line.main, CW)];
      for (const m of mains) {
        y += 46;
        if (draw) { ctx.font = FONT(600, 28); ctx.fillStyle = C.ink; ctx.fillText(m, L, y); }
      }
      if (line.sub) {
        y += 36;
        if (draw) {
          ctx.font = FONT(400, 23); ctx.fillStyle = C.ink2;
          ctx.fillText(ellipsize(ctx, line.sub, CW - 28), L + 28, y);
        }
      }
    }
  }
  y += 64;
  if (draw) hairline(ctx, y);
  y += 44;
  if (draw) {
    ctx.font = FONT(400, 24); ctx.fillStyle = C.muted; ctx.textAlign = 'center';
    ctx.fillText(`${model.footer} · ${model.dateLabel}`, W / 2, y);
    ctx.textAlign = 'left';
  }
  return y + 56;
}

export function renderCard(model) {
  const meas = document.createElement('canvas').getContext('2d');
  const H = walk(model, meas, false);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
  walk(model, ctx, true);
  return c;
}

// ---- Share / save ----

// Computed once. On file:// or plain http (non-secure contexts, incl. the
// headless e2e) navigator.share is undefined → false → download path.
export const CAN_SHARE_FILES = (() => {
  try {
    return !!(navigator.canShare &&
      navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
  } catch { return false; }
})();

// toBlob is CALLBACK-only on Safari 15 — never use a promise form.
export const cardBlob = (canvas) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));

export async function shareCard(blob, filename) {
  if (CAN_SHARE_FILES) {
    const file = new File([blob], filename, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'; // user closed the sheet — do NOT also download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  return 'downloaded';
}
