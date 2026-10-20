"use client";

import { useState } from "react";

/**
 * Grouped two-series bar chart (series-2 = first, series-1 = second) with a hover tooltip.
 * Thin bars, 4px rounded tops anchored to the baseline, 2px gap between the pair.
 */
export function BarsChart({
  labels,
  a,
  b,
  names,
  labelFormat = "date",
}: {
  labels: string[];
  a: number[];
  b: number[];
  names: [string, string];
  /** date: "YYYY-MM-DD" → "MM-DD"; sprint: "IT Sprint 12" → "S12" */
  labelFormat?: "date" | "sprint" | "raw";
}) {
  const short = (l: string) => (labelFormat === "date" ? l.slice(5) : labelFormat === "sprint" ? l.replace(/^.*?(\d+)\s*$/, "S$1").slice(0, 12) : l);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const W = Math.max(640, labels.length * 18), H = 240, pad = { l: 32, r: 8, t: 12, b: 28 };
  const max = Math.max(1, ...a, ...b);
  const unit = max > 40 ? 5 : 1;
  const step = max <= 5 ? 1 : Math.ceil(max / 4 / unit) * unit;
  const top = Math.ceil(max / step) * step;
  const bw = (W - pad.l - pad.r) / Math.max(1, labels.length), ih = H - pad.t - pad.b;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const every = Math.ceil(labels.length / 14);
  const bar = (x: number, w: number, v: number, color: string, key: string) => {
    if (!v) return null;
    const h = y(0) - y(v), r = Math.min(4, w / 2, h);
    return (
      <path
        key={key}
        d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + w - r} Q${x + w},${y(v)} ${x + w},${y(v) + r} V${y(0)} Z`}
        fill={color}
      />
    );
  };
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: Math.min(W, 640), display: "block" }} role="img" aria-label={names.join(" ба ")}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeDasharray={v ? "3 3" : undefined} />
              <text x={pad.l - 8} y={y(v) + 4} fontSize={11} textAnchor="end" fill="var(--axis)">
                {v}
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const x = pad.l + i * bw, gw = Math.min(bw * 0.72, 48), w = (gw - 2) / 2, x0 = x + (bw - gw) / 2;
            return (
              <g key={l}>
                {hover?.i === i && <rect x={x} y={pad.t} width={bw} height={ih} fill="var(--grid)" opacity={0.45} />}
                {bar(x0, w, a[i], "var(--series-2)", "a")}
                {bar(x0 + w + 2, w, b[i], "var(--series-1)", "b")}
                {i % every === 0 && (
                  <text x={x + bw / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="var(--axis)">
                    {short(l)}
                  </text>
                )}
                <rect
                  x={x}
                  y={pad.t}
                  width={bw}
                  height={ih}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const box = (e.currentTarget.ownerSVGElement!.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
                    setHover({ i, x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hover.x + 180 > 640 ? hover.x - 180 : hover.x + 12, top: hover.y - 10 }}
        >
          <div className="mb-1 font-medium">{labels[hover.i]}</div>
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="size-2 rounded-sm" style={{ background: k ? "var(--series-1)" : "var(--series-2)" }} />
              {names[k]}
              <b className="ml-auto pl-4 tabular-nums">{k ? b[hover.i] : a[hover.i]}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
