import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as DB from './db.js';
import { SEED_EXERCISES, INJURY_TAGS, PATTERNS, INBODY_FIELDS, FITNESS_TESTS, GOALS, PHASES } from './seed.js';
import { recommend, fmtRec, e1rmSeries, inbodySeries, injuryConflicts, historyFor, fmtSets, progressionOf, regressionOf, repRangeFor, stretchSuggestions, parseInBodyText } from './logic.js';
import LineChart from './chart.jsx';
import { loadSampleData } from './sample.js';
import { mdToHtml } from './md.js';
import GUIDE_MD from '../GUIDE.md';

const GUIDE_HTML = mdToHtml(GUIDE_MD); // computed once at module load

// ---------- tiny UI helpers ----------
const patternLabel = (id) => (PATTERNS.find((p) => p.id === id) || {}).label || id;
const goalLabel = (id) => (GOALS.find((g) => g.id === id) || {}).label || id;
const phaseLabel = (id) => (PHASES.find((p) => p.id === id) || {}).label || id;
const injuryLabel = (id) => (INJURY_TAGS.find((t) => t.id === id) || {}).label || id;
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDateLong = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const age = (dob) => {
  if (!dob) return null;
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
};

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Tap once → arms; tap again → fires. No blocking dialogs.
function ConfirmBtn({ label, armedLabel = 'Tap again to confirm', onConfirm, className = 'btn-danger' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={className + (armed ? ' armed' : '')} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? armedLabel : label}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function PhotoInput({ value, onChange, label = 'Photo' }) {
  const ref = useRef(null);
  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      onChange(c.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <div className="photo-input">
      {value ? (
        <div className="photo-preview">
          <img src={value} alt="" />
          <button className="btn-ghost" onClick={() => onChange(null)}>Remove</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => ref.current.click()}>Add {label.toLowerCase()}</button>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
    </div>
  );
}

function StatTile({ label, value, unit, delta, upIsGood }) {
  let deltaCls = 'delta-neutral';
  if (delta != null && delta !== 0 && upIsGood != null)
    deltaCls = (delta > 0) === upIsGood ? 'delta-good' : 'delta-bad';
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value != null ? value : '—'}<span className="stat-unit">{unit}</span></div>
      {delta != null && delta !== 0 && (
        <div className={'stat-delta ' + deltaCls}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} vs last</div>
      )}
    </div>
  );
}

function InjuryChips({ ids }) {
  if (!ids || !ids.length) return null;
  return (
    <span className="chip-row">
      {ids.map((t) => <span key={t} className="chip chip-injury">{injuryLabel(t)}</span>)}
    </span>
  );
}

// ---------- Client form ----------
function ClientForm({ initial, onSave, onClose }) {
  const [c, setC] = useState(initial || {
    id: DB.uid(), name: '', goal: 'general', phase: '', sex: '', dob: '', email: '', phone: '',
    injuries: [], injuryNotes: '', notes: '', photo: null, createdAt: todayISO(),
  });
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const toggleInjury = (t) => set('injuries', c.injuries.includes(t) ? c.injuries.filter((x) => x !== t) : [...c.injuries, t]);
  return (
    <Modal title={initial ? 'Edit client' : 'New client'} onClose={onClose}>
      <Field label="Name">
        <input value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" autoFocus />
      </Field>
      <div className="grid2">
        <Field label="Date of birth"><input type="date" value={c.dob} onChange={(e) => set('dob', e.target.value)} /></Field>
        <Field label="Sex">
          <select value={c.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="">—</option><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option>
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Phone"><input type="tel" value={c.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={c.email} onChange={(e) => set('email', e.target.value)} /></Field>
      </div>
      <Field label="Primary goal" hint="Sets the rep range recommendations use.">
        <select value={c.goal} onChange={(e) => set('goal', e.target.value)}>
          {GOALS.map((g) => <option key={g.id} value={g.id}>{g.label} ({g.reps[0]}–{g.reps[1]} reps)</option>)}
        </select>
      </Field>
      <Field label="OPT training phase" hint="(optional) Refines the rep range within the goal.">
        <select value={c.phase || ''} onChange={(e) => set('phase', e.target.value)}>
          <option value="">— none —</option>
          {PHASES.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.reps[0]}–{p.reps[1]} reps)</option>)}
        </select>
      </Field>
      <Field label="Injuries & limitations" hint="Flagged exercises will show a caution and a safer swap.">
        <div className="chip-row wrap">
          {INJURY_TAGS.map((t) => (
            <button key={t.id} className={'chip chip-toggle' + (c.injuries.includes(t.id) ? ' on' : '')} onClick={() => toggleInjury(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Injury notes"><textarea rows={2} value={c.injuryNotes} onChange={(e) => set('injuryNotes', e.target.value)} placeholder="Surgeries, doctor guidance, movements to avoid…" /></Field>
      <Field label="General notes"><textarea rows={2} value={c.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <Field label="Photo"><PhotoInput value={c.photo} onChange={(v) => set('photo', v)} /></Field>
      <div className="modal-actions">
        <button className="btn-primary" disabled={!c.name.trim()} onClick={() => onSave(c)}>Save client</button>
      </div>
    </Modal>
  );
}

// ---------- Exercise picker (grouped by pattern, shows recommendation inline) ----------
function ExercisePicker({ exercises, client, sessions, units, readiness, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [pat, setPat] = useState('');
  const shown = exercises.filter((e) =>
    (!pat || e.pattern === pat) &&
    (!q || e.name.toLowerCase().includes(q.toLowerCase())));
  const grouped = PATTERNS.map((p) => ({ p, items: shown.filter((e) => e.pattern === p.id).sort((a, b) => a.level - b.level) })).filter((g) => g.items.length);
  return (
    <Modal title="Add exercise" onClose={onClose} wide>
      <div className="picker-controls">
        <input placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chip-row wrap">
          <button className={'chip chip-toggle' + (!pat ? ' on' : '')} onClick={() => setPat('')}>All</button>
          {PATTERNS.map((p) => (
            <button key={p.id} className={'chip chip-toggle' + (pat === p.id ? ' on' : '')} onClick={() => setPat(p.id)}>{p.label}</button>
          ))}
        </div>
      </div>
      {grouped.map(({ p, items }) => (
        <div key={p.id} className="picker-group">
          <h3>{p.label}</h3>
          {items.map((e) => {
            const conf = injuryConflicts(e, client);
            const rec = client ? recommend(e, client, sessions, exercises, units, readiness || 'normal') : null;
            return (
              <button key={e.id} className={'picker-row' + (conf.length ? ' caution' : '')} onClick={() => onPick(e, rec)}>
                <span className="picker-name">{e.name}{conf.length ? ' ⚠️' : ''}</span>
                <span className="picker-rec">{rec && rec.kind !== 'caution' ? fmtRec(rec, units) : (conf.length ? 'Flagged: ' + conf.map(injuryLabel).join(', ') : '')}</span>
              </button>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}

// ---------- Session editor ----------
function SessionEditor({ session, client, exercises, sessions, units, onSave, onClose, onDelete }) {
  const [s, setS] = useState(session || { id: DB.uid(), clientId: client.id, date: todayISO(), readiness: 'normal', notes: '', entries: [] });
  const [picking, setPicking] = useState(false);
  const exById = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const priorSessions = useMemo(() => sessions.filter((x) => x.id !== s.id), [sessions, s.id]);

  const addExercise = (e, rec) => {
    const isTime = e.load === 'time' || (e.load === 'stretch' && e.stretchType === 'static');
    const repsOnly = e.load === 'stretch' && e.stretchType === 'dynamic';
    const lastSets = (historyFor(priorSessions, e.id)[0] || {}).sets;
    let n = (rec && rec.sets) || (lastSets && lastSets.length) || 3;
    let sets;
    if (rec && rec.kind !== 'caution' && (rec.weight || rec.reps || rec.seconds)) {
      const proto = isTime
        ? { seconds: rec.seconds || 30, rpe: '' }
        : repsOnly
          ? { reps: rec.reps || 10 }
          : { weight: rec.weight || '', reps: rec.reps || repRangeFor(client)[0], rpe: '' };
      sets = Array.from({ length: n }, () => ({ ...proto }));
    } else if (lastSets) {
      sets = lastSets.map((st) => ({ ...st, rpe: '' }));
    } else {
      const proto = isTime ? { seconds: 30, rpe: '' } : repsOnly ? { reps: 10 } : { weight: '', reps: repRangeFor(client)[0], rpe: '' };
      sets = Array.from({ length: 3 }, () => ({ ...proto }));
    }
    set('entries', [...s.entries, { exerciseId: e.id, sets, notes: '' }]);
    setPicking(false);
  };
  const updSet = (ei, si, k, v) => {
    const entries = s.entries.map((en, i) => i !== ei ? en : { ...en, sets: en.sets.map((st, j) => j !== si ? st : { ...st, [k]: v }) });
    set('entries', entries);
  };
  const addSet = (ei) => {
    const entries = s.entries.map((en, i) => i !== ei ? en : { ...en, sets: [...en.sets, { ...en.sets[en.sets.length - 1] }] });
    set('entries', entries);
  };
  const rmSet = (ei, si) => {
    const entries = s.entries.map((en, i) => i !== ei ? en : { ...en, sets: en.sets.filter((_, j) => j !== si) }).filter((en) => en.sets.length);
    set('entries', entries);
  };
  const rmEntry = (ei) => set('entries', s.entries.filter((_, i) => i !== ei));

  return (
    <Modal title={session ? 'Edit session' : 'New session — ' + client.name} onClose={onClose} wide>
      <div className="grid2">
        <Field label="Date"><input type="date" value={s.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Client readiness" hint="Low = slept badly / low energy; today's suggestions ease off.">
          <div className="chip-row">
            {[['normal', 'Normal'], ['low', 'Low energy']].map(([id, lbl]) => (
              <button key={id} className={'chip chip-toggle' + ((s.readiness || 'normal') === id ? ' on' : '')} onClick={() => set('readiness', id)}>{lbl}</button>
            ))}
          </div>
        </Field>
      </div>
      {s.entries.map((en, ei) => {
        const ex = exById[en.exerciseId] || { name: '(deleted exercise)', load: 'external' };
        const isTime = ex.load === 'time' || (ex.load === 'stretch' && ex.stretchType === 'static');
        const repsOnly = ex.load === 'stretch' && ex.stretchType === 'dynamic';
        const showRpe = ex.load !== 'stretch';
        const rec = recommend(ex, client, priorSessions, exercises, units, s.readiness || 'normal');
        const hist = historyFor(priorSessions, en.exerciseId);
        return (
          <div key={ei} className="entry-card">
            <div className="entry-head">
              <strong>{ex.name}</strong>
              <button className="btn-ghost" onClick={() => rmEntry(ei)}>Remove</button>
            </div>
            {rec && <div className={'rec-line' + (rec.kind === 'caution' ? ' warn' : '')}>{rec.kind === 'caution' ? '⚠️ ' + rec.why : 'Suggested: ' + fmtRec(rec, units) + ' — ' + rec.why}</div>}
            {hist[0] && <div className="hist-line">Last time ({fmtDateLong(hist[0].date)}): {fmtSets(hist[0].sets)}</div>}
            <div className="set-table">
              <div className="set-row set-head">
                <span>Set</span>{isTime ? <span>Seconds</span> : repsOnly ? <span>Reps</span> : <><span>Weight ({units})</span><span>Reps</span></>}{showRpe && <span>RPE</span>}<span />
              </div>
              {en.sets.map((st, si) => (
                <div key={si} className="set-row">
                  <span className="set-num">{si + 1}</span>
                  {isTime ? (
                    <input type="number" inputMode="decimal" value={st.seconds ?? ''} onChange={(e) => updSet(ei, si, 'seconds', e.target.value === '' ? '' : Number(e.target.value))} />
                  ) : repsOnly ? (
                    <input type="number" inputMode="numeric" value={st.reps ?? ''} onChange={(e) => updSet(ei, si, 'reps', e.target.value === '' ? '' : Number(e.target.value))} />
                  ) : (
                    <>
                      <input type="number" inputMode="decimal" value={st.weight ?? ''} onChange={(e) => updSet(ei, si, 'weight', e.target.value === '' ? '' : Number(e.target.value))} />
                      <input type="number" inputMode="numeric" value={st.reps ?? ''} onChange={(e) => updSet(ei, si, 'reps', e.target.value === '' ? '' : Number(e.target.value))} />
                    </>
                  )}
                  {showRpe && (
                    <select value={st.rpe ?? ''} onChange={(e) => updSet(ei, si, 'rpe', e.target.value === '' ? '' : Number(e.target.value))}>
                      <option value="">–</option>
                      {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  <button className="btn-ghost" onClick={() => rmSet(ei, si)} aria-label="Remove set">✕</button>
                </div>
              ))}
              <button className="btn-secondary btn-sm" onClick={() => addSet(ei)}>+ Add set</button>
            </div>
          </div>
        );
      })}
      {(() => {
        const pats = [...new Set(s.entries.map((en) => (exById[en.exerciseId] || {}).pattern).filter(Boolean))];
        const sg = stretchSuggestions(pats, exercises, client);
        return (sg.dynamic.length || sg.static.length) ? (
          <div className="rec-line">
            Warm-up: {sg.dynamic.map((e) => e.name).join(', ') || '—'} · Cooldown: {sg.static.map((e) => e.name).join(', ') || '—'}
          </div>
        ) : null;
      })()}
      <button className="btn-secondary" onClick={() => setPicking(true)}>+ Add exercise</button>
      <Field label="Session notes"><textarea rows={2} value={s.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Energy, form notes, anything to remember…" /></Field>
      <div className="modal-actions">
        {session && onDelete && <ConfirmBtn label="Delete session" onConfirm={() => onDelete(s)} />}
        <button className="btn-primary" disabled={!s.entries.length} onClick={() => onSave(s)}>Save session</button>
      </div>
      {picking && (
        <ExercisePicker exercises={exercises} client={client} sessions={priorSessions} units={units} readiness={s.readiness} onPick={addExercise} onClose={() => setPicking(false)} />
      )}
    </Modal>
  );
}

// ---------- Assessment forms ----------
function InBodyForm({ initial, client, units, onSave, onClose, onDelete }) {
  const [a, setA] = useState(initial || { id: DB.uid(), clientId: client.id, date: todayISO(), type: 'inbody', data: {}, notes: '', photo: null });
  const [pasted, setPasted] = useState('');
  const [fillMsg, setFillMsg] = useState('');
  const setD = (k, v) => setA((p) => ({ ...p, data: { ...p.data, [k]: v } }));
  const fillFromPaste = () => {
    const vals = parseInBodyText(pasted);
    const n = Object.keys(vals).length;
    if (n) setA((p) => ({ ...p, data: { ...p.data, ...vals } }));
    setFillMsg(n ? `Filled ${n} field${n === 1 ? '' : 's'}.` : 'No InBody values recognized — check the pasted text.');
  };
  return (
    <Modal title="InBody result" onClose={onClose}>
      <Field label="Date"><input type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} /></Field>
      <Field label="Paste from result sheet" hint="Photograph the printout, copy the text with Live Text, paste here.">
        <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste InBody text…" />
      </Field>
      <div className="btn-row">
        <button className="btn-secondary" disabled={!pasted.trim()} onClick={fillFromPaste}>Fill fields from pasted text</button>
      </div>
      {fillMsg && <p className={fillMsg.startsWith('Filled') ? 'ok-note' : 'muted small'}>{fillMsg}</p>}
      <div className="grid2">
        {INBODY_FIELDS.map((f) => (
          <Field key={f.id} label={f.label + (f.unitL ? ` (${units === 'kg' ? f.unitK : f.unitL})` : '')}>
            <input type="number" inputMode="decimal" value={a.data[f.id] ?? ''} onChange={(e) => setD(f.id, e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
        ))}
      </div>
      <Field label="Notes"><textarea rows={2} value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} /></Field>
      <Field label="Photo of result sheet"><PhotoInput value={a.photo} onChange={(v) => setA({ ...a, photo: v })} label="photo" /></Field>
      <div className="modal-actions">
        {initial && onDelete && <ConfirmBtn label="Delete" onConfirm={() => onDelete(a)} />}
        <button className="btn-primary" onClick={() => onSave(a)}>Save</button>
      </div>
    </Modal>
  );
}

function FitnessForm({ initial, client, onSave, onClose, onDelete }) {
  const [a, setA] = useState(initial || { id: DB.uid(), clientId: client.id, date: todayISO(), type: 'fitness', data: {}, notes: '' });
  const setD = (k, v) => setA((p) => ({ ...p, data: { ...p.data, [k]: v } }));
  return (
    <Modal title="Fitness assessment" onClose={onClose}>
      <Field label="Date"><input type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} /></Field>
      <div className="grid2">
        {FITNESS_TESTS.map((f) => (
          <Field key={f.id} label={`${f.label} (${f.unit})`}>
            <input type="number" inputMode="decimal" value={a.data[f.id] ?? ''} onChange={(e) => setD(f.id, e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
        ))}
      </div>
      <Field label="Notes"><textarea rows={2} value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} /></Field>
      <div className="modal-actions">
        {initial && onDelete && <ConfirmBtn label="Delete" onConfirm={() => onDelete(a)} />}
        <button className="btn-primary" onClick={() => onSave(a)}>Save</button>
      </div>
    </Modal>
  );
}

// ---------- Client detail tabs ----------
function PlanTab({ client, sessions, exercises, units, onStartSession }) {
  const recent = useMemo(() => {
    const seen = [];
    for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
      for (const en of s.entries || []) if (!seen.includes(en.exerciseId)) seen.push(en.exerciseId);
    }
    return seen.slice(0, 10);
  }, [sessions]);
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const items = recent.map((id) => exById[id]).filter(Boolean);

  return (
    <div>
      <div className="row-between">
        <p className="muted">Next-session suggestions from {client.name.split(' ')[0]}’s history, goal ({goalLabel(client.goal)}{client.phase ? ', ' + phaseLabel(client.phase) + ' phase' : ''}) and injury flags.</p>
        <button className="btn-primary" onClick={onStartSession}>Start session</button>
      </div>
      {!items.length && <div className="empty-note">No sessions logged yet. Start a session and the plan will build itself from what you log.</div>}
      {items.length > 0 && (() => {
        const sg = stretchSuggestions([...new Set(items.map((e) => e.pattern))], exercises, client);
        return (sg.dynamic.length || sg.static.length) ? (
          <div className="rec-card">
            <div className="rec-top"><strong>Warm-up / Cooldown</strong></div>
            {sg.dynamic.length > 0 && <div className="rec-why">Warm-up (dynamic): {sg.dynamic.map((e) => e.name).join(' · ')}</div>}
            {sg.static.length > 0 && <div className="rec-why">Cooldown (static): {sg.static.map((e) => e.name).join(' · ')}</div>}
            <div className="rec-links muted small">{sg.why}</div>
          </div>
        ) : null;
      })()}
      {items.map((ex) => {
        const rec = recommend(ex, client, sessions, exercises, units);
        const prog = progressionOf(ex, exercises, client);
        const reg = regressionOf(ex, exercises, client);
        return (
          <div key={ex.id} className={'rec-card' + (rec.kind === 'caution' ? ' warn' : '')}>
            <div className="rec-top">
              <div>
                <strong>{ex.name}</strong>
                <span className="muted small"> · {patternLabel(ex.pattern)}</span>
              </div>
              {rec.kind !== 'caution' && <div className="rec-rx">{fmtRec(rec, units)}</div>}
            </div>
            <div className={'rec-why' + (rec.kind === 'caution' ? ' warn-text' : '')}>{rec.kind === 'caution' ? '⚠️ ' + rec.why : rec.why}</div>
            {rec.switchTo && <div className="rec-switch">→ Suggested swap: <strong>{rec.switchTo.name}</strong></div>}
            <div className="rec-links muted small">
              {prog && <span>Progression: {prog.name}</span>}
              {prog && reg && <span> · </span>}
              {reg && <span>Regression: {reg.name}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SessionsTab({ client, sessions, exercises, units, refresh }) {
  const [editing, setEditing] = useState(null); // session object or 'new'
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const save = async (s) => { await DB.put('sessions', s); setEditing(null); refresh(); };
  const remove = async (s) => { await DB.del('sessions', s.id); setEditing(null); refresh(); };
  return (
    <div>
      <div className="row-between">
        <p className="muted">{sorted.length} session{sorted.length === 1 ? '' : 's'} logged</p>
        <button className="btn-primary" onClick={() => setEditing('new')}>Log session</button>
      </div>
      {sorted.map((s) => (
        <button key={s.id} className="list-row" onClick={() => setEditing(s)}>
          <span className="list-main">{fmtDateLong(s.date)}</span>
          <span className="list-sub">{(s.entries || []).map((en) => (exById[en.exerciseId] || {}).name || '?').join(' · ')}</span>
        </button>
      ))}
      {editing && (
        <SessionEditor
          session={editing === 'new' ? null : editing}
          client={client} exercises={exercises} sessions={sessions} units={units}
          onSave={save} onClose={() => setEditing(null)} onDelete={remove}
        />
      )}
    </div>
  );
}

function ChartCard({ title, points, unit }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      <LineChart points={points} unit={unit} />
      {points.length > 0 && (
        <details className="table-view">
          <summary>Table view</summary>
          <table>
            <thead><tr><th>Date</th><th>{title}</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.x}><td>{p.x}</td><td>{p.y}{unit && ' ' + unit}</td></tr>)}</tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function ProgressTab({ client, sessions, assessments, exercises, units }) {
  const wUnit = units;
  const metrics = [
    { id: 'weight', label: 'Weight', unit: wUnit },
    { id: 'smm', label: 'Muscle mass', unit: wUnit },
    { id: 'pbf', label: 'Body fat %', unit: '%' },
  ];
  const [metric, setMetric] = useState('weight');
  const bodyPoints = inbodySeries(assessments, metric);

  const trained = useMemo(() => {
    const counts = {};
    for (const s of sessions) for (const en of s.entries || []) counts[en.exerciseId] = (counts[en.exerciseId] || 0) + 1;
    return exercises.filter((e) => counts[e.id] >= 2 && e.load !== 'time' && e.load !== 'stretch').sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  }, [sessions, exercises]);
  const [exId, setExId] = useState('');
  const chosen = exId || (trained[0] && trained[0].id) || '';
  const strengthPoints = chosen ? e1rmSeries(sessions, chosen) : [];
  const chosenEx = exercises.find((e) => e.id === chosen);

  const m = metrics.find((x) => x.id === metric);
  return (
    <div>
      <div className="chip-row wrap filter-row">
        {metrics.map((x) => (
          <button key={x.id} className={'chip chip-toggle' + (metric === x.id ? ' on' : '')} onClick={() => setMetric(x.id)}>{x.label}</button>
        ))}
      </div>
      <ChartCard title={m.label + ' (InBody)'} points={bodyPoints} unit={m.unit} />
      <div className="card chart-card">
        <div className="row-between">
          <h3>Strength — estimated 1RM</h3>
          <select value={chosen} onChange={(e) => setExId(e.target.value)}>
            {trained.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            {!trained.length && <option value="">No exercise with 2+ logs yet</option>}
          </select>
        </div>
        <LineChart points={strengthPoints} unit={units} />
        {chosenEx && strengthPoints.length > 0 && (
          <details className="table-view">
            <summary>Table view</summary>
            <table>
              <thead><tr><th>Date</th><th>e1RM ({units})</th></tr></thead>
              <tbody>{strengthPoints.map((p) => <tr key={p.x}><td>{p.x}</td><td>{p.y}</td></tr>)}</tbody>
            </table>
          </details>
        )}
        <p className="muted small">Estimated one-rep max (Epley) from the best set each session — rising line = getting stronger, even when reps and weights bounce around.</p>
      </div>
    </div>
  );
}

function AssessTab({ client, assessments, units, refresh }) {
  const [form, setForm] = useState(null); // {type, record?}
  const sorted = [...assessments].sort((a, b) => b.date.localeCompare(a.date));
  const save = async (a) => { await DB.put('assessments', a); setForm(null); refresh(); };
  const remove = async (a) => { await DB.del('assessments', a.id); setForm(null); refresh(); };
  const label = (a) => a.type === 'inbody' ? 'InBody' : 'Fitness tests';
  const summary = (a) => {
    if (a.type === 'inbody') {
      const parts = [];
      if (a.data.weight != null && a.data.weight !== '') parts.push(`${a.data.weight} ${units}`);
      if (a.data.pbf != null && a.data.pbf !== '') parts.push(`${a.data.pbf}% BF`);
      if (a.data.smm != null && a.data.smm !== '') parts.push(`SMM ${a.data.smm}`);
      return parts.join(' · ');
    }
    return Object.entries(a.data).filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${(FITNESS_TESTS.find((t) => t.id === k) || { label: k }).label.split(' (')[0]}: ${v}`).join(' · ');
  };
  return (
    <div>
      <div className="row-between">
        <p className="muted">InBody scans and fitness tests</p>
        <div className="btn-row">
          <button className="btn-secondary" onClick={() => setForm({ type: 'fitness' })}>+ Fitness test</button>
          <button className="btn-primary" onClick={() => setForm({ type: 'inbody' })}>+ InBody</button>
        </div>
      </div>
      {sorted.map((a) => (
        <button key={a.id} className="list-row" onClick={() => setForm({ type: a.type, record: a })}>
          <span className="list-main">{fmtDateLong(a.date)} <span className={'chip ' + (a.type === 'inbody' ? 'chip-blue' : 'chip-gray')}>{label(a)}</span></span>
          <span className="list-sub">{summary(a)}{a.photo ? ' · 📷' : ''}</span>
        </button>
      ))}
      {!sorted.length && <div className="empty-note">No assessments yet. Add her client’s first InBody scan or baseline fitness tests.</div>}
      {form && form.type === 'inbody' && <InBodyForm initial={form.record} client={client} units={units} onSave={save} onClose={() => setForm(null)} onDelete={remove} />}
      {form && form.type === 'fitness' && <FitnessForm initial={form.record} client={client} onSave={save} onClose={() => setForm(null)} onDelete={remove} />}
    </div>
  );
}

function ClientDetail({ client, exercises, units, onBack, onEdit, onDeleteClient, refreshClients }) {
  const [tab, setTab] = useState('plan');
  const [sessions, setSessions] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [logging, setLogging] = useState(false);
  const [rev, setRev] = useState(0);
  const refresh = () => setRev((r) => r + 1);

  useEffect(() => {
    DB.getAllByClient('sessions', client.id).then(setSessions);
    DB.getAllByClient('assessments', client.id).then(setAssessments);
  }, [client.id, rev]);

  const inbody = assessments.filter((a) => a.type === 'inbody').sort((a, b) => b.date.localeCompare(a.date));
  const latest = inbody[0], prev = inbody[1];
  const delta = (f) => latest && prev && latest.data[f] != null && prev.data[f] != null && latest.data[f] !== '' && prev.data[f] !== ''
    ? Math.round((latest.data[f] - prev.data[f]) * 10) / 10 : null;

  const tabs = [['plan', 'Plan'], ['sessions', 'Sessions'], ['progress', 'Progress'], ['assess', 'Assessments']];
  return (
    <div>
      <button className="btn-ghost back" onClick={onBack}>‹ All clients</button>
      <div className="client-head">
        {client.photo ? <img className="avatar" src={client.photo} alt="" /> : <div className="avatar avatar-blank">{client.name.slice(0, 1)}</div>}
        <div className="client-head-info">
          <h2>{client.name}</h2>
          <div className="muted">
            {goalLabel(client.goal)}
            {client.phase && ` · ${phaseLabel(client.phase)} phase`}
            {age(client.dob) != null && ` · ${age(client.dob)} yrs`}
            {client.phone && ` · ${client.phone}`}
          </div>
          <InjuryChips ids={client.injuries} />
        </div>
        <div className="btn-row">
          <button className="btn-secondary" onClick={onEdit}>Edit</button>
          <ConfirmBtn label="Delete" onConfirm={onDeleteClient} className="btn-danger btn-sm" />
        </div>
      </div>
      {client.injuryNotes && <div className="note-strip">⚠️ {client.injuryNotes}</div>}
      {latest && (
        <div className="stat-row">
          <StatTile label="Weight" value={latest.data.weight} unit={' ' + units} delta={delta('weight')} upIsGood={null} />
          <StatTile label="Muscle mass" value={latest.data.smm} unit={' ' + units} delta={delta('smm')} upIsGood={true} />
          <StatTile label="Body fat" value={latest.data.pbf} unit=" %" delta={delta('pbf')} upIsGood={false} />
          <StatTile label="Visceral fat" value={latest.data.vfl} unit="" delta={delta('vfl')} upIsGood={false} />
        </div>
      )}
      <div className="tabs">
        {tabs.map(([id, lbl]) => (
          <button key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>
      {tab === 'plan' && <PlanTab client={client} sessions={sessions} exercises={exercises} units={units} onStartSession={() => { setTab('sessions'); setLogging(true); }} />}
      {tab === 'sessions' && <SessionsTab client={client} sessions={sessions} exercises={exercises} units={units} refresh={refresh} />}
      {tab === 'progress' && <ProgressTab client={client} sessions={sessions} assessments={assessments} exercises={exercises} units={units} />}
      {tab === 'assess' && <AssessTab client={client} assessments={assessments} units={units} refresh={refresh} />}
      {logging && (
        <SessionEditor client={client} exercises={exercises} sessions={sessions} units={units}
          onSave={async (s) => { await DB.put('sessions', s); setLogging(false); refresh(); }}
          onClose={() => setLogging(false)} />
      )}
    </div>
  );
}

// ---------- Clients list ----------
function ClientsView({ clients, exercises, units, refresh }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);
  const open = clients.find((c) => c.id === openId);

  const save = async (c) => { await DB.put('clients', c); setAdding(false); setEditing(null); refresh(); };
  const removeClient = async (c) => {
    for (const s of await DB.getAllByClient('sessions', c.id)) await DB.del('sessions', s.id);
    for (const a of await DB.getAllByClient('assessments', c.id)) await DB.del('assessments', a.id);
    await DB.del('clients', c.id);
    setOpenId(null); refresh();
  };

  if (open) {
    return (
      <>
        <ClientDetail client={open} exercises={exercises} units={units}
          onBack={() => setOpenId(null)} onEdit={() => setEditing(open)}
          onDeleteClient={() => removeClient(open)} refreshClients={refresh} />
        {editing && <ClientForm initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      </>
    );
  }

  const shown = clients.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <div className="row-between">
        <input className="search" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" onClick={() => setAdding(true)}>+ New client</button>
      </div>
      {shown.map((c) => (
        <button key={c.id} className="list-row client-row" onClick={() => setOpenId(c.id)}>
          {c.photo ? <img className="avatar sm" src={c.photo} alt="" /> : <div className="avatar sm avatar-blank">{c.name.slice(0, 1)}</div>}
          <span className="list-main">{c.name}</span>
          <span className="list-sub">{goalLabel(c.goal)}</span>
          <InjuryChips ids={c.injuries} />
        </button>
      ))}
      {!clients.length && (
        <div className="empty-note">
          No clients yet. Tap <strong>New client</strong> to add the first one — or load sample data from Settings to explore the app.
        </div>
      )}
      {adding && <ClientForm onSave={save} onClose={() => setAdding(false)} />}
    </div>
  );
}

// ---------- Exercise library ----------
function ExerciseForm({ onSave, onClose }) {
  const [e, setE] = useState({ id: DB.uid(), name: '', pattern: 'squat', level: 3, load: 'external', region: 'lower', contra: [], cue: '', custom: true });
  const set = (k, v) => setE((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="New exercise" onClose={onClose}>
      <Field label="Name"><input value={e.name} onChange={(ev) => set('name', ev.target.value)} autoFocus /></Field>
      {e.load !== 'stretch' && (
        <div className="grid2">
          <Field label="Movement pattern">
            <select value={e.pattern} onChange={(ev) => set('pattern', ev.target.value)}>
              {PATTERNS.filter((p) => p.id !== 'stretch').map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Difficulty (1 easy – 6 hard)">
            <input type="number" min={1} max={6} value={e.level} onChange={(ev) => set('level', Number(ev.target.value))} />
          </Field>
        </div>
      )}
      <div className="grid2">
        <Field label="Loading">
          <select value={e.load} onChange={(ev) => set('load', ev.target.value)}>
            <option value="external">Weighted</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="time">Timed (seconds)</option>
            <option value="stretch">Stretch</option>
          </select>
        </Field>
        <Field label="Body region">
          <select value={e.region} onChange={(ev) => set('region', ev.target.value)}>
            <option value="lower">Lower body</option><option value="upper">Upper body</option><option value="core">Core</option>
          </select>
        </Field>
      </div>
      {e.load === 'stretch' && (
        <>
          <Field label="Stretch type">
            <select value={e.stretchType || 'static'} onChange={(ev) => set('stretchType', ev.target.value)}>
              <option value="static">Static (hold — cooldown)</option>
              <option value="dynamic">Dynamic (moving — warm-up)</option>
            </select>
          </Field>
          <Field label="Preps / cools these patterns" hint="Used to match warm-up and cooldown suggestions.">
            <div className="chip-row wrap">
              {PATTERNS.filter((p) => p.id !== 'stretch').map((p) => (
                <button key={p.id} className={'chip chip-toggle' + ((e.targets || []).includes(p.id) ? ' on' : '')}
                  onClick={() => set('targets', (e.targets || []).includes(p.id) ? e.targets.filter((x) => x !== p.id) : [...(e.targets || []), p.id])}>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
      <Field label="Caution for these injuries">
        <div className="chip-row wrap">
          {INJURY_TAGS.map((t) => (
            <button key={t.id} className={'chip chip-toggle' + (e.contra.includes(t.id) ? ' on' : '')}
              onClick={() => set('contra', e.contra.includes(t.id) ? e.contra.filter((x) => x !== t.id) : [...e.contra, t.id])}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Coaching cue"><input value={e.cue} onChange={(ev) => set('cue', ev.target.value)} /></Field>
      <div className="modal-actions">
        <button className="btn-primary" disabled={!e.name.trim()} onClick={() => onSave(e.load === 'stretch' ? { ...e, pattern: 'stretch', level: 1, stretchType: e.stretchType || 'static', targets: e.targets || [] } : e)}>Save exercise</button>
      </div>
    </Modal>
  );
}

function LibraryView({ exercises, refresh }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="row-between">
        <p className="muted">Each pattern is a chain — easiest regression at the top, hardest progression at the bottom. Recommendations move clients along these chains.</p>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add exercise</button>
      </div>
      {PATTERNS.map((p) => {
        const items = exercises.filter((e) => e.pattern === p.id).sort((a, b) => a.level - b.level);
        if (!items.length) return null;
        return (
          <div key={p.id} className="card">
            <h3>{p.label}</h3>
            {items.map((e, i) => (
              <div key={e.id} className="lib-row">
                <span className="lib-level">{'▲'.repeat(0)}{e.level}</span>
                <span className="lib-name">{e.name}{e.custom ? ' •' : ''}</span>
                <span className="lib-meta muted small">
                  {e.load === 'stretch' ? (e.stretchType === 'dynamic' ? 'dynamic stretch' : 'static stretch') : e.load === 'bodyweight' ? 'bodyweight' : e.load === 'time' ? 'timed' : 'weighted'}
                  {e.contra && e.contra.length ? ' · ⚠️ ' + e.contra.map(injuryLabel).join(', ') : ''}
                </span>
                {e.custom && <ConfirmBtn label="✕" armedLabel="Delete?" className="btn-ghost btn-sm" onConfirm={async () => { await DB.del('exercises', e.id); refresh(); }} />}
              </div>
            ))}
          </div>
        );
      })}
      {adding && <ExerciseForm onSave={async (e) => { await DB.put('exercises', e); setAdding(false); refresh(); }} onClose={() => setAdding(false)} />}
    </div>
  );
}

// ---------- Settings ----------
function SettingsView({ units, setUnits, refresh, counts }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [persisted, setPersisted] = useState(null);
  useEffect(() => {
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(setPersisted);
  }, []);

  const doExport = async () => {
    const payload = await DB.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trainerpad-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg('Backup exported — save it to Files / iCloud Drive.');
  };
  const doImport = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const payload = JSON.parse(await f.text());
      await DB.importAll(payload, { replace: true });
      setMsg('Backup restored.');
      refresh();
    } catch (err) {
      setMsg('Could not restore: ' + err.message);
    }
    e.target.value = '';
  };

  return (
    <div>
      <div className="card">
        <h3>Units</h3>
        <div className="chip-row">
          {['lb', 'kg'].map((u) => (
            <button key={u} className={'chip chip-toggle' + (units === u ? ' on' : '')} onClick={() => setUnits(u)}>{u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Backup</h3>
        <p className="muted">All data lives on this iPad. Export a backup regularly (weekly is a good habit) and save it to iCloud Drive — if the iPad is lost or Safari clears its storage, the backup restores everything.</p>
        <div className="btn-row">
          <button className="btn-primary" onClick={doExport}>Export backup</button>
          <button className="btn-secondary" onClick={() => fileRef.current.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={doImport} />
        </div>
        {msg && <p className="ok-note">{msg}</p>}
        <p className="muted small">
          Stored: {counts.clients} clients · {counts.sessions} sessions · {counts.assessments} assessments.
          {persisted != null && (persisted ? ' Storage is protected from automatic cleanup.' : ' Tip: add this app to your Home Screen so the iPad protects its storage.')}
        </p>
      </div>
      <div className="card">
        <h3>Explore</h3>
        <p className="muted">New here? Load two sample clients with history to see how plans, charts and recommendations work. You can delete them any time.</p>
        <button className="btn-secondary" onClick={async () => { await loadSampleData(); setMsg('Sample clients added.'); refresh(); }}>Load sample data</button>
      </div>
      <div className="card">
        <h3>About recommendations</h3>
        <p className="muted small">
          Suggestions use standard coaching heuristics, applied to each client’s own history: <strong>double progression</strong> (fill the goal rep range, then add weight — +2.5% upper body, +5% lower body), <strong>RPE guardrails</strong> (average RPE ≥ 9.5 triggers a ~10% deload), rep-ceiling triggers that advance bodyweight moves up their <strong>progression chain</strong>, and injury flags that surface safer swaps within the same movement pattern. They’re a starting point for your judgment, not a replacement for it.
        </p>
      </div>
    </div>
  );
}

// ---------- Help ----------
function HelpView() {
  return (
    <div>
      <h2>Help</h2>
      <div className="card">
        <div className="help" dangerouslySetInnerHTML={{ __html: GUIDE_HTML }} />
      </div>
    </div>
  );
}

// ---------- App ----------
function App() {
  const [ready, setReady] = useState(false);
  // docs/guide.html redirects to #help — boot straight into the Help view then.
  const [view, setView] = useState(() => (location.hash === '#help' ? 'help' : 'clients'));
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [units, setUnitsState] = useState('lb');
  const [counts, setCounts] = useState({ clients: 0, sessions: 0, assessments: 0 });
  const [rev, setRev] = useState(0);
  const refresh = () => setRev((r) => r + 1);

  useEffect(() => {
    (async () => {
      DB.requestPersistence();
      let ex = await DB.getAll('exercises');
      // Top up any missing seed exercises (not just first run) so existing
      // installs receive newly added library entries, and a restore from an
      // older backup self-heals.
      const have = new Set(ex.map((e) => e.id));
      const missing = SEED_EXERCISES.filter((e) => !have.has(e.id));
      if (missing.length) {
        for (const e of missing) await DB.put('exercises', e);
        ex = await DB.getAll('exercises');
      }
      const settings = await DB.get('settings', 'units');
      setUnitsState((settings && settings.value) || 'lb');
      setExercises(ex);
      const cl = await DB.getAll('clients');
      setClients(cl);
      const ss = await DB.getAll('sessions');
      const as = await DB.getAll('assessments');
      setCounts({ clients: cl.length, sessions: ss.length, assessments: as.length });
      setReady(true);
    })();
  }, [rev]);

  const setUnits = async (u) => { await DB.put('settings', { key: 'units', value: u }); setUnitsState(u); };

  if (!ready) return <div className="loading">Loading…</div>;

  const nav = [['clients', 'Clients'], ['library', 'Exercises'], ['help', 'Help'], ['settings', 'Settings']];
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">TP</span> TrainerPad</div>
        <nav className="topnav">
          {nav.map(([id, lbl]) => (
            <button key={id} className={'tab' + (view === id ? ' on' : '')} onClick={() => setView(id)}>{lbl}</button>
          ))}
        </nav>
      </header>
      <main className="content">
        {view === 'clients' && <ClientsView clients={clients} exercises={exercises} units={units} refresh={refresh} />}
        {view === 'library' && <LibraryView exercises={exercises} refresh={refresh} />}
        {view === 'help' && <HelpView />}
        {view === 'settings' && <SettingsView units={units} setUnits={setUnits} refresh={refresh} counts={counts} />}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
