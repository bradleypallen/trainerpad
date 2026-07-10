// Single-series SVG line chart, per dataviz specs:
// 2px line, ~10% area wash, ≥8px end marker with 2px surface ring,
// solid hairline gridlines, crosshair + tooltip, endpoint direct label.
// Single series → no legend; the card title names it.
import React, { useMemo, useRef, useState } from 'react';

const PAD = { top: 14, right: 64, bottom: 26, left: 40 };

function niceTicks(min, max, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
  const lo = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = lo; v <= max + step * 0.01; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const fmtDate = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function LineChart({ points, unit = '', width = 560, height = 200 }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null); // index

  const model = useMemo(() => {
    if (!points || points.length === 0) return null;
    const xs = points.map((p) => new Date(p.x + 'T12:00:00').getTime());
    const ys = points.map((p) => p.y);
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    const padY = (yMax - yMin) * 0.15 || Math.abs(yMax) * 0.1 || 1;
    yMin -= padY; yMax += padY;
    const ticks = niceTicks(yMin, yMax, 4);
    yMin = Math.min(yMin, ticks[0]);
    yMax = Math.max(yMax, ticks[ticks.length - 1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const X = (t) => x1 === x0 ? PAD.left + plotW / 2 : PAD.left + ((t - x0) / (x1 - x0)) * plotW;
    const Y = (v) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const pts = points.map((p, i) => ({ ...p, px: X(xs[i]), py: Y(p.y) }));
    return { pts, ticks, Y, plotH, plotW };
  }, [points, width, height]);

  if (!model) {
    return <div className="chart-empty">No data yet — entries will chart here.</div>;
  }
  const { pts, ticks, Y } = model;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.px},${p.py}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].px},${height - PAD.bottom} L${pts[0].px},${height - PAD.bottom} Z`;
  const last = pts[pts.length - 1];
  const hp = hover != null ? pts[hover] : null;

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.px - mx); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  return (
    <div className="chart-wrap">
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={Y(t)} y2={Y(t)} className="gridline" />
            <text x={PAD.left - 6} y={Y(t) + 3.5} className="axis-text" textAnchor="end">{t}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={width - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} className="baseline" />
        {/* x labels: first and last date */}
        <text x={pts[0].px} y={height - 8} className="axis-text" textAnchor="start">{fmtDate(pts[0].x)}</text>
        {pts.length > 1 && (
          <text x={last.px} y={height - 8} className="axis-text" textAnchor="end">{fmtDate(last.x)}</text>
        )}
        <path d={area} className="area-wash" />
        <path d={line} className="series-line" fill="none" />
        {/* crosshair */}
        {hp && <line x1={hp.px} x2={hp.px} y1={PAD.top} y2={height - PAD.bottom} className="crosshair" />}
        {hp && <circle cx={hp.px} cy={hp.py} r={5} className="marker" />}
        {/* endpoint marker + direct label */}
        <circle cx={last.px} cy={last.py} r={4.5} className="marker" />
        <text x={last.px + 8} y={last.py + 4} className="end-label">{last.y}{unit && ` ${unit}`}</text>
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: `${(hp.px / width) * 100}%` }}>
          <span className="tip-value">{hp.y}{unit && ` ${unit}`}</span>
          <span className="tip-date">{fmtDate(hp.x)}</span>
        </div>
      )}
    </div>
  );
}
