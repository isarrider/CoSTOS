import React from 'react';
import { WatchdogTopologyId } from '../physics/model';

interface WatchdogCircuitSvgProps {
  topologyId: WatchdogTopologyId;
}

const W = '#0f172a';
const W_MUTED = '#475569';
const BLUE = '#1d4ed8';
const GREEN = '#047857';
const AMBER = '#b45309';
const RED = '#b91c1c';

const Dot: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = W }) => (
  <circle cx={x} cy={y} r={2.8} fill={color} />
);

const Gnd: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g stroke={W} strokeWidth={1.6} strokeLinecap="round">
    <line x1={x} y1={y} x2={x} y2={y + 8} />
    <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} />
    <line x1={x - 6} y1={y + 12} x2={x + 6} y2={y + 12} />
    <line x1={x - 2.5} y1={y + 16} x2={x + 2.5} y2={y + 16} />
  </g>
);

const Vcc: React.FC<{ x: number; y: number; label: string; color?: string }> = ({
  x,
  y,
  label,
  color = RED,
}) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y - 10} stroke={color} strokeWidth={1.7} />
    <line x1={x - 8} y1={y - 10} x2={x + 8} y2={y - 10} stroke={color} strokeWidth={2.1} />
    <text
      x={x}
      y={y - 14}
      textAnchor="middle"
      fontSize="9.5"
      fontFamily="ui-monospace, monospace"
      fontWeight={700}
      fill={color}
    >
      {label}
    </text>
  </g>
);

const ResH: React.FC<{
  x1: number;
  x2: number;
  y: number;
  label?: string;
  sub?: string;
  labelDy?: number;
  stroke?: string;
}> = ({ x1, x2, y, label, sub, labelDy = -9, stroke = W }) => {
  const mid = (x1 + x2) / 2;
  const bodyW = Math.min(34, Math.max(20, (x2 - x1) * 0.62));
  const bx1 = mid - bodyW / 2;
  const bx2 = mid + bodyW / 2;
  const step = bodyW / 6;
  const amp = 4.8;
  const pts = [
    `${x1},${y}`,
    `${bx1},${y}`,
    `${bx1 + step * 0.5},${y - amp}`,
    `${bx1 + step * 1.5},${y + amp}`,
    `${bx1 + step * 2.5},${y - amp}`,
    `${bx1 + step * 3.5},${y + amp}`,
    `${bx1 + step * 4.5},${y - amp}`,
    `${bx1 + step * 5.5},${y + amp}`,
    `${bx2},${y}`,
    `${x2},${y}`,
  ].join(' ');
  return (
    <g>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
      {label && (
        <text
          x={mid}
          y={y + labelDy}
          textAnchor="middle"
          fontSize="9.2"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fill={stroke}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={mid}
          y={y + (labelDy < 0 ? 15 : labelDy + 11)}
          textAnchor="middle"
          fontSize="8.3"
          fontFamily="ui-monospace, monospace"
          fill={W_MUTED}
        >
          {sub}
        </text>
      )}
    </g>
  );
};

const ResV: React.FC<{
  x: number;
  y1: number;
  y2: number;
  label?: string;
  sub?: string;
  side?: 'left' | 'right';
  stroke?: string;
}> = ({ x, y1, y2, label, sub, side = 'right', stroke = W }) => {
  const mid = (y1 + y2) / 2;
  const bodyH = Math.min(32, Math.max(18, (y2 - y1) * 0.62));
  const by1 = mid - bodyH / 2;
  const by2 = mid + bodyH / 2;
  const step = bodyH / 6;
  const amp = 4.6;
  const pts = [
    `${x},${y1}`,
    `${x},${by1}`,
    `${x + amp},${by1 + step * 0.5}`,
    `${x - amp},${by1 + step * 1.5}`,
    `${x + amp},${by1 + step * 2.5}`,
    `${x - amp},${by1 + step * 3.5}`,
    `${x + amp},${by1 + step * 4.5}`,
    `${x - amp},${by1 + step * 5.5}`,
    `${x},${by2}`,
    `${x},${y2}`,
  ].join(' ');
  const tx = side === 'right' ? x + 9 : x - 9;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
      {label && (
        <text
          x={tx}
          y={mid - (sub ? 2 : -3)}
          textAnchor={anchor}
          fontSize="9.2"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fill={stroke}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={tx}
          y={mid + 9}
          textAnchor={anchor}
          fontSize="8.2"
          fontFamily="ui-monospace, monospace"
          fill={W_MUTED}
        >
          {sub}
        </text>
      )}
    </g>
  );
};

const CapH: React.FC<{
  x1: number;
  x2: number;
  y: number;
  label?: string;
  sub?: string;
  stroke?: string;
}> = ({ x1, x2, y, label, sub, stroke = W }) => {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={mid - 3.5} y2={y} stroke={stroke} strokeWidth={1.6} />
      <line x1={mid - 3.5} y1={y - 10} x2={mid - 3.5} y2={y + 10} stroke={stroke} strokeWidth={2.1} />
      <line x1={mid + 3.5} y1={y - 10} x2={mid + 3.5} y2={y + 10} stroke={stroke} strokeWidth={2.1} />
      <line x1={mid + 3.5} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={1.6} />
      {label && (
        <text
          x={mid}
          y={y - 14}
          textAnchor="middle"
          fontSize="9.2"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fill={stroke}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={mid}
          y={y + 20}
          textAnchor="middle"
          fontSize="8.2"
          fontFamily="ui-monospace, monospace"
          fill={W_MUTED}
        >
          {sub}
        </text>
      )}
    </g>
  );
};

const CapV: React.FC<{
  x: number;
  y1: number;
  y2: number;
  label?: string;
  sub?: string;
  side?: 'left' | 'right';
  stroke?: string;
}> = ({ x, y1, y2, label, sub, side = 'right', stroke = W }) => {
  const mid = (y1 + y2) / 2;
  const tx = side === 'right' ? x + 12 : x - 12;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={mid - 3.5} stroke={stroke} strokeWidth={1.6} />
      <line x1={x - 9} y1={mid - 3.5} x2={x + 9} y2={mid - 3.5} stroke={stroke} strokeWidth={2.1} />
      <line x1={x - 9} y1={mid + 3.5} x2={x + 9} y2={mid + 3.5} stroke={stroke} strokeWidth={2.1} />
      <line x1={x} y1={mid + 3.5} x2={x} y2={y2} stroke={stroke} strokeWidth={1.6} />
      {label && (
        <text
          x={tx}
          y={mid - (sub ? 2 : -3)}
          textAnchor={anchor}
          fontSize="9.2"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fill={stroke}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={tx}
          y={mid + 9}
          textAnchor={anchor}
          fontSize="8.2"
          fontFamily="ui-monospace, monospace"
          fill={W_MUTED}
        >
          {sub}
        </text>
      )}
    </g>
  );
};

const DiodeH: React.FC<{
  x1: number;
  x2: number;
  y: number;
  label?: string;
  sub?: string;
  stroke?: string;
}> = ({ x1, x2, y, label, sub, stroke = W }) => {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={mid - 6} y2={y} stroke={stroke} strokeWidth={1.6} />
      <polygon points={`${mid - 6},${y - 6.5} ${mid - 6},${y + 6.5} ${mid + 6},${y}`} fill={stroke} />
      <line x1={mid + 6} y1={y - 7} x2={mid + 6} y2={y + 7} stroke={stroke} strokeWidth={2} />
      <line x1={mid + 6} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={1.6} />
      {label && (
        <text
          x={mid}
          y={y - 11}
          textAnchor="middle"
          fontSize="9.2"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fill={stroke}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={mid}
          y={y + 17}
          textAnchor="middle"
          fontSize="8.1"
          fontFamily="ui-monospace, monospace"
          fill={W_MUTED}
        >
          {sub}
        </text>
      )}
    </g>
  );
};

const DiodeUp: React.FC<{
  x: number;
  yTop: number;
  yBot: number;
  label?: string;
  sub?: string;
  side?: 'left' | 'right';
  stroke?: string;
}> = ({ x, yTop, yBot, label, sub, side = 'right', stroke = W }) => {
  const mid = (yTop + yBot) / 2;
  const tx = side === 'right' ? x + 10 : x - 10;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <line x1={x} y1={yBot} x2={x} y2={mid + 6} stroke={stroke} strokeWidth={1.6} />
      <polygon points={`${x - 6},${mid + 6} ${x + 6},${mid + 6} ${x},${mid - 6}`} fill={stroke} />
      <line x1={x - 7} y1={mid - 6} x2={x + 7} y2={mid - 6} stroke={stroke} strokeWidth={2} />
      <line x1={x} y1={mid - 6} x2={x} y2={yTop} stroke={stroke} strokeWidth={1.6} />
      {label && (
        <text
          x={tx}
          y={mid - (sub ? 1 : -3)}
          textAnchor={anchor}
          fontSize="9.1"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fill={stroke}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={tx}
          y={mid + 9}
          textAnchor={anchor}
          fontSize="8"
          fontFamily="ui-monospace, monospace"
          fill={W_MUTED}
        >
          {sub}
        </text>
      )}
    </g>
  );
};

// Authentic IEEE N-Channel Enhancement MOSFET (Gate left, Drain top, Source bottom)
const NMosfet: React.FC<{
  gx: number;
  cy: number;
  label: string;
  sub?: string;
  stroke?: string;
}> = ({ gx, cy, label, sub, stroke = W }) => (
  <g>
    <circle cx={gx + 14} cy={cy} r={14} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.1} />
    <line x1={gx} y1={cy + 6} x2={gx + 7} y2={cy + 6} stroke={stroke} strokeWidth={1.6} />
    <line x1={gx + 7} y1={cy - 9} x2={gx + 7} y2={cy + 9} stroke={stroke} strokeWidth={1.9} />
    <line x1={gx + 11.5} y1={cy - 9} x2={gx + 11.5} y2={cy - 4} stroke={stroke} strokeWidth={1.8} />
    <line x1={gx + 11.5} y1={cy - 2} x2={gx + 11.5} y2={cy + 2.5} stroke={stroke} strokeWidth={1.8} />
    <line x1={gx + 11.5} y1={cy + 4.5} x2={gx + 11.5} y2={cy + 9} stroke={stroke} strokeWidth={1.8} />
    <line x1={gx + 11.5} y1={cy - 6.5} x2={gx + 22} y2={cy - 6.5} stroke={stroke} strokeWidth={1.6} />
    <line x1={gx + 22} y1={cy - 6.5} x2={gx + 22} y2={cy - 18} stroke={stroke} strokeWidth={1.6} />
    <line x1={gx + 11.5} y1={cy} x2={gx + 22} y2={cy} stroke={stroke} strokeWidth={1.5} />
    <polygon points={`${gx + 12},${cy} ${gx + 17},${cy - 2.8} ${gx + 17},${cy + 2.8}`} fill={stroke} />
    <line x1={gx + 11.5} y1={cy + 6.5} x2={gx + 22} y2={cy + 6.5} stroke={stroke} strokeWidth={1.6} />
    <line x1={gx + 22} y1={cy} x2={gx + 22} y2={cy + 18} stroke={stroke} strokeWidth={1.6} />
    <text
      x={gx + 31}
      y={cy - 2}
      fontSize="9.2"
      fontFamily="ui-monospace, monospace"
      fontWeight={700}
      fill={stroke}
    >
      {label}
    </text>
    {sub && (
      <text
        x={gx + 31}
        y={cy + 9}
        fontSize="8.1"
        fontFamily="ui-monospace, monospace"
        fill={W_MUTED}
      >
        {sub}
      </text>
    )}
  </g>
);

// Authentic IEEE P-Channel High-Side MOSFET (horizontal: Source left, Drain right, Gate bottom)
const PMosfetH: React.FC<{
  cx: number;
  sy: number;
  label: string;
  sub?: string;
  stroke?: string;
}> = ({ cx, sy, label, sub, stroke = W }) => (
  <g>
    <circle cx={cx} cy={sy + 8} r={14} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.1} />
    {/* Source left, Drain right */}
    <line x1={cx - 18} y1={sy} x2={cx - 7} y2={sy} stroke={stroke} strokeWidth={1.6} />
    <line x1={cx - 7} y1={sy} x2={cx - 7} y2={sy + 8} stroke={stroke} strokeWidth={1.6} />
    <line x1={cx + 7} y1={sy} x2={cx + 18} y2={sy} stroke={stroke} strokeWidth={1.6} />
    <line x1={cx + 7} y1={sy} x2={cx + 7} y2={sy + 8} stroke={stroke} strokeWidth={1.6} />
    {/* Broken horizontal channel */}
    <line x1={cx - 10} y1={sy + 8} x2={cx - 4.5} y2={sy + 8} stroke={stroke} strokeWidth={1.8} />
    <line x1={cx - 2.5} y1={sy + 8} x2={cx + 2.5} y2={sy + 8} stroke={stroke} strokeWidth={1.8} />
    <line x1={cx + 4.5} y1={sy + 8} x2={cx + 10} y2={sy + 8} stroke={stroke} strokeWidth={1.8} />
    {/* Body arrow pointing OUTWARD (P-channel) */}
    <line x1={cx} y1={sy} x2={cx} y2={sy + 8} stroke={stroke} strokeWidth={1.4} />
    <polygon points={`${cx},${sy + 1} ${cx - 2.8},${sy + 5.5} ${cx + 2.8},${sy + 5.5}`} fill={stroke} />
    {/* Insulated gate bar */}
    <line x1={cx - 10} y1={sy + 12.5} x2={cx + 10} y2={sy + 12.5} stroke={stroke} strokeWidth={1.9} />
    <line x1={cx - 6} y1={sy + 12.5} x2={cx - 6} y2={sy + 22} stroke={stroke} strokeWidth={1.6} />
    <text
      x={cx}
      y={sy - 11}
      textAnchor="middle"
      fontSize="9.2"
      fontFamily="ui-monospace, monospace"
      fontWeight={700}
      fill={stroke}
    >
      {label}
    </text>
    {sub && (
      <text
        x={cx}
        y={sy - 1}
        textAnchor="middle"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
        fill={W_MUTED}
      >
        {sub}
      </text>
    )}
  </g>
);

// Authentic IEEE PNP BJT (Base left, Emitter top, Collector bottom, arrow pointing IN at emitter)
const PnpBjt: React.FC<{
  bx: number;
  cy: number;
  label: string;
  sub?: string;
  stroke?: string;
}> = ({ bx, cy, label, sub, stroke = W }) => (
  <g>
    <circle cx={bx + 12} cy={cy} r={13} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.1} />
    <line x1={bx} y1={cy} x2={bx + 8} y2={cy} stroke={stroke} strokeWidth={1.6} />
    <line x1={bx + 8} y1={cy - 8} x2={bx + 8} y2={cy + 8} stroke={stroke} strokeWidth={2.2} />
    {/* Emitter top */}
    <line x1={bx + 8} y1={cy - 4} x2={bx + 18} y2={cy - 10} stroke={stroke} strokeWidth={1.6} />
    <line x1={bx + 18} y1={cy - 10} x2={bx + 18} y2={cy - 18} stroke={stroke} strokeWidth={1.6} />
    {/* Inward PNP emitter arrow */}
    <polygon points={`${bx + 9},${cy - 4.6} ${bx + 14.5},${cy - 5} ${bx + 12.5},${cy - 9.2}`} fill={stroke} />
    {/* Collector bottom */}
    <line x1={bx + 8} y1={cy + 4} x2={bx + 18} y2={cy + 10} stroke={stroke} strokeWidth={1.6} />
    <line x1={bx + 18} y1={cy + 10} x2={bx + 18} y2={cy + 18} stroke={stroke} strokeWidth={1.6} />
    <text
      x={bx + 28}
      y={cy - 2}
      fontSize="9.1"
      fontFamily="ui-monospace, monospace"
      fontWeight={700}
      fill={stroke}
    >
      {label}
    </text>
    {sub && (
      <text
        x={bx + 28}
        y={cy + 9}
        fontSize="8"
        fontFamily="ui-monospace, monospace"
        fill={W_MUTED}
      >
        {sub}
      </text>
    )}
  </g>
);

export const WatchdogCircuitSvg: React.FC<WatchdogCircuitSvgProps> = ({ topologyId }) => {
  if (topologyId === 'u3b_schmitt_wd') {
    return (
      <svg
        viewBox="0 0 820 265"
        className="w-full h-auto bg-white border border-slate-200 rounded-md"
        role="img"
        aria-label="Dedicated U4 LM393 Dual-Schmitt Window Watchdog Rev B Gemini Schematic"
      >
        <text x={14} y={18} fontSize="10.2" fontFamily="ui-monospace, monospace" fontWeight={700} fill={GREEN}>
          LOCKED · REV B: DEDICATED U4 (LM393DR2G C7955) DUAL-SCHMITT — U4A RELAY (+5V) &amp; U4B PUMP/RB (+3.3V)
        </text>

        {/* GPIO24 Heartbeat Input */}
        <rect x={14} y={84} width={72} height={32} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.4} />
        <text x={50} y={97} textAnchor="middle" fontSize="9.2" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          GPIO 24
        </text>
        <text x={50} y={109} textAnchor="middle" fontSize="7.8" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          20 Hz HB
        </text>

        {/* R48 4.7k + C16 100nF */}
        <ResH x1={86} x2={146} y={100} label="R48 4.7k" sub="340 Hz LPF" />
        <Dot x={146} y={100} />
        <CapV x={146} y1={100} y2={166} label="C16" sub="100nF" side="left" />
        <Gnd x={146} y={166} />

        {/* C17 + C19 Series DC-Blocking Charge Pump */}
        <CapH x1={146} x2={198} y={100} label="C17" sub="1uF" />
        <CapH x1={198} x2={250} y={100} label="C19" sub="1uF" />
        <Dot x={250} y={100} />
        <DiodeUp x={250} yTop={100} yBot={166} label="D20" sub="1N4148W" side="left" />
        <Gnd x={250} y={166} />
        <DiodeH x1={250} x2={308} y={100} label="D19" sub="1N4148W" />
        <Dot x={308} y={100} color={BLUE} />

        {/* V_CAP Hold Network: 2x22uF + 2x1.0M (500k, ~15.4-17.7s) */}
        <line x1={308} y1={100} x2={394} y2={100} stroke={BLUE} strokeWidth={1.7} />
        <text x={352} y={91} textAnchor="middle" fontSize="8.6" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          V_CAP (2.17V ss)
        </text>
        <CapV x={308} y1={100} y2={166} label="C18A/B" sub="2×22uF 1206" side="right" stroke={BLUE} />
        <Gnd x={308} y={166} />
        <Dot x={364} y={100} color={BLUE} />
        <ResV x={364} y1={100} y2={166} label="R49∥R50" sub="2×1.0M" side="right" />
        <Gnd x={364} y={166} />

        {/* Split V_CAP to BOTH U4A (-) top and U4B (-) bottom */}
        <Dot x={394} y={100} color={BLUE} />
        <line x1={394} y1={56} x2={394} y2={178} stroke={BLUE} strokeWidth={1.6} />
        <line x1={394} y1={56} x2={442} y2={56} stroke={BLUE} strokeWidth={1.6} />
        <line x1={394} y1={178} x2={442} y2={178} stroke={BLUE} strokeWidth={1.6} />

        {/* ===== TOP CHANNEL: U4A (+5V Relay Q12) ===== */}
        <polygon points="442,40 442,96 498,68" fill="#ecfdf5" stroke={GREEN} strokeWidth={1.8} strokeLinejoin="round" />
        <text x={449} y={60} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight={700} fill={GREEN}>−</text>
        <text x={449} y={82} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight={700} fill={GREEN}>+</text>
        <text x={468} y={66} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={GREEN}>U4A</text>
        <text x={468} y={76} textAnchor="middle" fontSize="7.2" fontFamily="ui-monospace, monospace" fill={W_MUTED}>1.54/0.93V</text>

        {/* U4A Schmitt feedback note on Pin 3 (+) */}
        <line x1={418} y1={78} x2={442} y2={78} stroke={GREEN} strokeWidth={1.3} />
        <line x1={418} y1={78} x2={418} y2={114} stroke={GREEN} strokeWidth={1.3} />
        <ResH x1={418} x2={514} y={114} label="R57A 220k" sub="R55A 100k / R56A 47k" labelDy={-7} stroke={GREEN} />
        <line x1={514} y1={68} x2={514} y2={114} stroke={GREEN} strokeWidth={1.3} />
        <Dot x={514} y={68} color={GREEN} />

        {/* U4A Pin 1 -> R45 10k (+5V) + Direct Q12 AO3401A */}
        <line x1={498} y1={68} x2={608} y2={68} stroke={GREEN} strokeWidth={1.8} />
        <text x={550} y={81} textAnchor="middle" fontSize="8.2" fontFamily="ui-monospace, monospace" fontWeight={700} fill={GREEN}>
          ~WD_REL
        </text>
        <Dot x={548} y={68} color={GREEN} />
        <ResV x={548} y1={34} y2={68} label="R45" sub="10k" side="left" />
        <Vcc x={548} y={34} label="+5V" />
        <line x1={548} y1={34} x2={596} y2={34} stroke={RED} strokeWidth={1.7} />
        <Dot x={548} y={34} color={RED} />
        <PMosfetH cx={614} sy={34} label="Q12 AO3401A" sub="D25 Pop. (16.1s)" stroke={GREEN} />
        <line x1={608} y1={68} x2={608} y2={56} stroke={GREEN} strokeWidth={1.6} />
        <line x1={632} y1={34} x2={704} y2={34} stroke={RED} strokeWidth={1.9} />
        <rect x={704} y={22} width={104} height={26} rx={4} fill="#fef2f2" stroke={RED} strokeWidth={1.4} />
        <text x={756} y={33} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
          +5V_REL
        </text>
        <text x={756} y={43} textAnchor="middle" fontSize="7.4" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          REL1 / REL2
        </text>

        {/* ===== BOTTOM CHANNEL: U4B (+3.3V GPIO20 + LED + Q15 -> Q5 Pump) ===== */}
        <polygon points="442,162 442,218 498,190" fill="#eff6ff" stroke={BLUE} strokeWidth={1.8} strokeLinejoin="round" />
        <text x={449} y={182} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>−</text>
        <text x={449} y={204} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>+</text>
        <text x={468} y={188} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>U4B</text>
        <text x={468} y={198} textAnchor="middle" fontSize="7.2" fontFamily="ui-monospace, monospace" fill={W_MUTED}>1.56/0.81V</text>

        {/* U4B Schmitt feedback */}
        <line x1={418} y1={200} x2={442} y2={200} stroke={BLUE} strokeWidth={1.3} />
        <line x1={418} y1={200} x2={418} y2={234} stroke={BLUE} strokeWidth={1.3} />
        <ResH x1={418} x2={514} y={234} label="R57B 100k" sub="R55B 100k / R56B 47k" labelDy={-7} stroke={BLUE} />
        <line x1={514} y1={190} x2={514} y2={234} stroke={BLUE} strokeWidth={1.3} />
        <Dot x={514} y={190} color={BLUE} />

        {/* U4B Pin 7 (+3.3V domain) -> R51 10k + Direct GPIO20/LED + Q15 -> Q5 */}
        <line x1={498} y1={190} x2={610} y2={190} stroke={BLUE} strokeWidth={1.8} />
        <Dot x={548} y={190} color={BLUE} />
        <ResV x={548} y1={142} y2={190} label="R51" sub="10k" side="left" />
        <Vcc x={548} y={142} label="+3V3" color={AMBER} />
        <line x1={548} y1={190} x2={548} y2={224} stroke={BLUE} strokeWidth={1.5} />
        <line x1={548} y1={224} x2={582} y2={224} stroke={BLUE} strokeWidth={1.5} />
        <rect x={582} y={210} width={108} height={26} rx={4} fill="#f8fafc" stroke={BLUE} strokeWidth={1.3} />
        <text x={636} y={221} textAnchor="middle" fontSize="8.4" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          GPIO 20 + D3 LED
        </text>
        <text x={636} y={231} textAnchor="middle" fontSize="7.3" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Direct 3.3V (no Q14!)
        </text>

        {/* Q15 MMBT3906 (+3.3V) -> Q5 Pump Gate */}
        <ResH x1={610} x2={656} y={190} label="R53" sub="10k" />
        <PnpBjt bx={656} cy={190} label="Q15" sub="3906" />
        <Vcc x={674} y={172} label="+3V3" color={AMBER} />
        <line x1={674} y1={208} x2={710} y2={208} stroke={BLUE} strokeWidth={1.6} />
        <line x1={710} y1={208} x2={710} y2={152} stroke={BLUE} strokeWidth={1.6} />
        <rect x={704} y={120} width={104} height={32} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.4} />
        <text x={756} y={133} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          Q5 AO3400A
        </text>
        <text x={756} y={145} textAnchor="middle" fontSize="7.4" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          H3 Pump (18.4s)
        </text>

        <text x={14} y={258} fontSize="8.2" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Rev B (Unscaled 34 s TI LM393 SPICE): Q12 +5V_REL 16.11 s (D25 Pop.) · WD_OK 18.42 s · 1 kHz max 0.745 V · Deletes Q13 &amp; Q14
        </text>
      </svg>
    );
  }

  if (topologyId === 'd24_cap_pump') {
    return (
      <svg
        viewBox="0 0 820 265"
        className="w-full h-auto bg-white border border-slate-200 rounded-md"
        role="img"
        aria-label="Claude D24 Passive Charge Pump Watchdog Schematic"
      >
        <text x={14} y={19} fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={AMBER}>
          CLAUDE D24 PROPOSAL: PASSIVE CHARGE-PUMP (1.1 MΩ) DIRECTLY DRIVING 3× AO3400A GATES (SLOW RAMP)
        </text>

        <rect x={14} y={84} width={78} height={32} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.4} />
        <text x={53} y={97} textAnchor="middle" fontSize="9.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          GPIO 24
        </text>
        <text x={53} y={109} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          20 Hz HB
        </text>

        <ResH x1={92} x2={160} y={100} label="R48 4.7k" sub="340 Hz LPF" />
        <Dot x={160} y={100} />
        <CapV x={160} y1={100} y2={170} label="C16" sub="100nF" side="left" />
        <Gnd x={160} y={170} />

        <CapH x1={160} x2={220} y={100} label="C17" sub="470nF" />
        <CapH x1={220} x2={280} y={100} label="C19" sub="470nF" />
        <Dot x={280} y={100} />
        <DiodeUp x={280} yTop={100} yBot={170} label="D20" sub="1N4148W" side="left" />
        <Gnd x={280} y={170} />
        <DiodeH x1={280} x2={346} y={100} label="D19" sub="1N4148W" />

        {/* High-Z 1.1M WD_OK node */}
        <line x1={346} y1={100} x2={520} y2={100} stroke={AMBER} strokeWidth={1.9} />
        <text x={450} y={89} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight={700} fill={AMBER}>
          WD_OK (2.32 V · 1.1 MΩ High-Z)
        </text>
        <Dot x={346} y={100} color={AMBER} />
        <CapV x={346} y1={100} y2={170} label="C18" sub="10uF" side="right" stroke={AMBER} />
        <Gnd x={346} y={170} />

        <Dot x={410} y={100} color={AMBER} />
        <ResV x={410} y1={100} y2={170} label="R49" sub="2.2M" side="right" />
        <Gnd x={410} y={170} />

        <Dot x={464} y={100} color={AMBER} />
        <ResV x={464} y1={100} y2={170} label="R50" sub="2.2M" side="right" />
        <Gnd x={464} y={170} />

        {/* Fanout directly to Q13 (Relay), Q5 (Pump), Q14 (GPIO20) */}
        <Dot x={520} y={100} color={AMBER} />
        <line x1={520} y1={100} x2={520} y2={206} stroke={AMBER} strokeWidth={1.6} />

        {/* Q13 + Q12 Relay Switch */}
        <line x1={520} y1={100} x2={556} y2={100} stroke={AMBER} strokeWidth={1.6} />
        <NMosfet gx={556} cy={94} label="Q13" sub="AO3400A" />
        <Gnd x={578} y={112} />
        <line x1={578} y1={76} x2={578} y2={48} stroke={W} strokeWidth={1.6} />
        <ResV x={622} y1={48} y2={76} label="R45" sub="100k" side="right" />
        <line x1={578} y1={76} x2={654} y2={76} stroke={W} strokeWidth={1.6} />
        <Dot x={578} y={76} />
        <Vcc x={622} y={48} label="+5V" />
        <line x1={622} y1={48} x2={642} y2={48} stroke={RED} strokeWidth={1.7} />
        <PMosfetH cx={660} sy={48} label="Q12 AO3401A" sub="Slow brown-out!" stroke={AMBER} />
        <line x1={678} y1={48} x2={716} y2={48} stroke={RED} strokeWidth={1.8} />
        <rect x={716} y={35} width={92} height={26} rx={4} fill="#fef2f2" stroke={RED} strokeWidth={1.3} />
        <text x={762} y={46} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
          +5V_REL
        </text>
        <text x={762} y={56} textAnchor="middle" fontSize="7.5" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          REL1 / REL2
        </text>

        {/* Q5 Pump Gate */}
        <line x1={520} y1={154} x2={556} y2={154} stroke={AMBER} strokeWidth={1.6} />
        <Dot x={520} y={154} color={AMBER} />
        <NMosfet gx={556} cy={148} label="Q5" sub="Pump H3" />
        <Gnd x={578} y={166} />

        {/* Q14 GPIO20 Readback */}
        <line x1={520} y1={206} x2={556} y2={206} stroke={AMBER} strokeWidth={1.6} />
        <NMosfet gx={556} cy={200} label="Q14" sub="GPIO20" />
        <Gnd x={578} y={218} />
        <line x1={578} y1={182} x2={676} y2={182} stroke={BLUE} strokeWidth={1.5} />
        <ResV x={644} y1={144} y2={182} label="R51" sub="10k" side="right" />
        <Vcc x={644} y={144} label="+3V3" color={AMBER} />
        <Dot x={644} y={182} color={BLUE} />
        <rect x={676} y={168} width={132} height={28} rx={4} fill="#fffbeb" stroke={AMBER} strokeWidth={1.3} />
        <text x={742} y={180} textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={AMBER}>
          GPIO 20 Readback
        </text>
        <text x={742} y={190} textAnchor="middle" fontSize="7.4" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          V_th differs from Q13!
        </text>

        <text x={14} y={254} fontSize="8.5" fontFamily="ui-monospace, monospace" fill={AMBER}>
          Warning: 3 independent AO3400A thresholds (0.65–1.45 V) → 5–14 s spread, 2 s linear relay ramp, 30 mV stall margin
        </text>
      </svg>
    );
  }

  if (topologyId === '74lvc1g123') {
    return (
      <svg
        viewBox="0 0 820 265"
        className="w-full h-auto bg-white border border-slate-200 rounded-md"
        role="img"
        aria-label="Original 74LVC1G123 and TPS22918 Baseline Schematic"
      >
        <text x={14} y={19} fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>
          ORIGINAL BASELINE: 74LVC1G123 MONOSTABLE + TPS22918 LOAD SWITCH (2× EXTENDED FEE = €5.60)
        </text>

        <rect x={22} y={92} width={86} height={34} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.4} />
        <text x={65} y={107} textAnchor="middle" fontSize="9.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          GPIO 24
        </text>
        <text x={65} y={119} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Edge Trig
        </text>

        <line x1={108} y1={109} x2={196} y2={109} stroke={W} strokeWidth={1.7} />
        <text x={152} y={101} textAnchor="middle" fontSize="8.2" fontFamily="ui-monospace, monospace" fill={RED}>
          No LPF (accepts 2 kHz!)
        </text>

        {/* 74LVC1G123 IC */}
        <rect x={196} y={66} width={156} height={96} rx={5} fill="#f8fafc" stroke={W} strokeWidth={1.8} />
        <text x={274} y={96} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>
          U3: 74LVC1G123
        </text>
        <text x={274} y={111} textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Retriggerable Mono
        </text>
        <text x={274} y={125} textAnchor="middle" fontSize="8.2" fontFamily="ui-monospace, monospace" fill={RED}>
          Extended (+€2.80 fee)
        </text>
        <text x={204} y={112} fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>B</text>
        <text x={342} y={112} textAnchor="end" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>Q</text>
        <Vcc x={274} y={66} label="+3V3" color={AMBER} />

        {/* Timing RC */}
        <line x1={234} y1={162} x2={234} y2={208} stroke={W} strokeWidth={1.5} />
        <ResH x1={164} x2={234} y={208} label="R_ext 300k" sub="τ = 3.0 s" />
        <Vcc x={164} y={208} label="+3V3" color={AMBER} />
        <CapV x={306} y1={162} y2={220} label="C_ext" sub="10uF" side="right" />
        <Gnd x={306} y={220} />

        {/* Output Q -> TPS22918 & Q5 */}
        <line x1={352} y1={109} x2={466} y2={109} stroke={BLUE} strokeWidth={1.8} />
        <text x={409} y={100} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          WD_OK (3.3V)
        </text>
        <Dot x={430} y={109} color={BLUE} />

        {/* TPS22918 Load Switch */}
        <rect x={466} y={60} width={156} height={74} rx={5} fill="#fef2f2" stroke={RED} strokeWidth={1.6} />
        <text x={544} y={84} textAnchor="middle" fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
          U7: TPS22918
        </text>
        <text x={544} y={99} textAnchor="middle" fontSize="8.4" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          5 V Load Switch (SOT-23-6)
        </text>
        <text x={544} y={114} textAnchor="middle" fontSize="8.2" fontFamily="ui-monospace, monospace" fill={RED}>
          Extended (+€2.80 fee)
        </text>
        <Vcc x={544} y={60} label="+5V IN" />
        <line x1={622} y1={96} x2={694} y2={96} stroke={RED} strokeWidth={1.9} />
        <rect x={694} y={82} width={106} height={28} rx={4} fill="#fef2f2" stroke={RED} strokeWidth={1.4} />
        <text x={747} y={94} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
          +5V_REL
        </text>
        <text x={747} y={104} textAnchor="middle" fontSize="7.6" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          REL1 / REL2
        </text>

        {/* Q5 Pump Gate */}
        <line x1={430} y1={109} x2={430} y2={192} stroke={BLUE} strokeWidth={1.6} />
        <line x1={430} y1={192} x2={504} y2={192} stroke={BLUE} strokeWidth={1.6} />
        <NMosfet gx={504} cy={186} label="Q5 AO3400A" sub="Pump H3 Gate" />
        <Gnd x={526} y={204} />

        <text x={14} y={254} fontSize="8.5" fontFamily="ui-monospace, monospace" fill={RED}>
          Drawbacks: €5.60 extended fees · 3.0 s trips on Linux stalls · accepts 2 kHz runaway loop · no GPIO20 readback
        </text>
      </svg>
    );
  }

  if (topologyId === 'ne555_missing_pulse') {
    return (
      <svg
        viewBox="0 0 820 265"
        className="w-full h-auto bg-white border border-slate-200 rounded-md"
        role="img"
        aria-label="NE555 Missing Pulse Detector Schematic"
      >
        <text x={14} y={19} fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>
          NE555 MISSING-PULSE DETECTOR: CRISP 5 V DRIVE, BUT ACCEPTS RUNAWAY LOOPS &amp; DRAWS ~5 mA
        </text>

        <rect x={14} y={90} width={76} height={32} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.4} />
        <text x={52} y={104} textAnchor="middle" fontSize="9.2" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          GPIO 24
        </text>
        <text x={52} y={115} textAnchor="middle" fontSize="7.8" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Heartbeat
        </text>

        <CapH x1={90} x2={152} y={106} label="C_ac" sub="100nF" />
        <ResH x1={152} x2={204} y={106} label="10k" />
        <PnpBjt bx={204} cy={106} label="Q_rst" sub="3906" />
        <Gnd x={222} y={124} />

        {/* Timing RC R_t + C_t */}
        <line x1={222} y1={88} x2={290} y2={88} stroke={W} strokeWidth={1.6} />
        <Dot x={290} y={88} />
        <ResV x={290} y1={42} y2={88} label="R_t" sub="470k" side="left" />
        <Vcc x={290} y={42} label="+5V" />
        <CapV x={290} y1={88} y2={168} label="C_t" sub="10uF" side="left" />
        <Gnd x={290} y={168} />

        {/* NE555DR IC */}
        <line x1={290} y1={88} x2={360} y2={88} stroke={W} strokeWidth={1.7} />
        <line x1={328} y1={88} x2={328} y2={122} stroke={W} strokeWidth={1.5} />
        <Dot x={328} y={88} />
        <line x1={328} y1={122} x2={360} y2={122} stroke={W} strokeWidth={1.5} />
        <rect x={360} y={64} width={144} height={96} rx={5} fill="#f8fafc" stroke={W} strokeWidth={1.8} />
        <text x={432} y={98} textAnchor="middle" fontSize="11.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>
          NE555DR
        </text>
        <text x={432} y={114} textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Missing-Pulse (5.5 s)
        </text>
        <text x={432} y={129} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill={AMBER}>
          ~5 mA + 100 mA spikes
        </text>
        <text x={368} y={91} fontSize="8" fontFamily="ui-monospace, monospace" fill={W}>TH (6)</text>
        <text x={368} y={125} fontSize="8" fontFamily="ui-monospace, monospace" fill={W}>TR (2)</text>
        <text x={496} y={110} textAnchor="end" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>OUT (3)</text>
        <Vcc x={432} y={64} label="+5V" />

        {/* Output -> Q13/Q12, Q5, Q14 */}
        <line x1={504} y1={107} x2={590} y2={107} stroke={BLUE} strokeWidth={1.8} />
        <text x={547} y={98} textAnchor="middle" fontSize="8.6" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          WD_OK (4.8V)
        </text>
        <Dot x={590} y={107} color={BLUE} />
        <line x1={590} y1={66} x2={590} y2={188} stroke={BLUE} strokeWidth={1.6} />

        <line x1={590} y1={66} x2={624} y2={66} stroke={BLUE} strokeWidth={1.6} />
        <rect x={624} y={50} width={178} height={32} rx={4} fill="#fef2f2" stroke={RED} strokeWidth={1.3} />
        <text x={713} y={64} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
          Q13 → Q12 (+5V_REL)
        </text>
        <text x={713} y={75} textAnchor="middle" fontSize="7.6" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Crisp 5 V snap shutoff
        </text>

        <line x1={590} y1={126} x2={624} y2={126} stroke={BLUE} strokeWidth={1.6} />
        <rect x={624} y={110} width={178} height={32} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.3} />
        <text x={713} y={124} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
          Q5 AO3400A (Pump H3)
        </text>
        <text x={713} y={135} textAnchor="middle" fontSize="7.6" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Full 4.8 V gate overdrive
        </text>

        <line x1={590} y1={188} x2={624} y2={188} stroke={BLUE} strokeWidth={1.6} />
        <rect x={624} y={172} width={178} height={32} rx={4} fill="#f8fafc" stroke={W_MUTED} strokeWidth={1.3} />
        <text x={713} y={186} textAnchor="middle" fontSize="8.8" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>
          Q14 → GPIO 20 + LED
        </text>
        <text x={713} y={197} textAnchor="middle" fontSize="7.6" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
          Matches 5.5 s timeout
        </text>

        <text x={14} y={254} fontSize="8.5" fontFamily="ui-monospace, monospace" fill={RED}>
          Drawbacks: Accepts runaway 2 kHz–100 kHz toggle loops · extra SOIC-8 IC despite free U3B · 5 mA quiescent
        </text>
      </svg>
    );
  }

  // tps3823_supervisor
  return (
    <svg
      viewBox="0 0 820 265"
      className="w-full h-auto bg-white border border-slate-200 rounded-md"
      role="img"
      aria-label="TPS3823-33 Supervisor IC Watchdog Schematic"
    >
      <text x={14} y={19} fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>
        TPS3823-33 DEDICATED SUPERVISOR: COMPACT 6-PART IC, BUT 1.6 s FAILS LINUX STALLS &amp; €5.60 FEE
      </text>

      <rect x={22} y={92} width={86} height={34} rx={4} fill="#eff6ff" stroke={BLUE} strokeWidth={1.4} />
      <text x={65} y={107} textAnchor="middle" fontSize="9.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
        GPIO 24
      </text>
      <text x={65} y={119} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
        WDI Input
      </text>

      <line x1={108} y1={109} x2={204} y2={109} stroke={W} strokeWidth={1.7} />
      <text x={156} y={101} textAnchor="middle" fontSize="8.1" fontFamily="ui-monospace, monospace" fill={RED}>
        No upper f limit (&gt;1 MHz)
      </text>

      <rect x={204} y={66} width={166} height={92} rx={5} fill="#fef2f2" stroke={RED} strokeWidth={1.7} />
      <text x={287} y={96} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
        TPS3823-33
      </text>
      <text x={287} y={111} textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
        Fixed 1.6 s (0.9 s min!)
      </text>
      <text x={287} y={126} textAnchor="middle" fontSize="8.2" fontFamily="ui-monospace, monospace" fill={RED}>
        Extended (+€2.80 fee)
      </text>
      <text x={212} y={112} fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>WDI</text>
      <text x={362} y={112} textAnchor="end" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={W}>~RST</text>
      <Vcc x={287} y={66} label="+3V3" color={AMBER} />
      <Gnd x={287} y={158} />

      <line x1={370} y1={109} x2={474} y2={109} stroke={BLUE} strokeWidth={1.8} />
      <Dot x={436} y={109} color={BLUE} />
      <text x={408} y={100} textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={BLUE}>
        3.3V CMOS
      </text>

      <rect x={474} y={62} width={156} height={74} rx={5} fill="#fef2f2" stroke={RED} strokeWidth={1.5} />
      <text x={552} y={88} textAnchor="middle" fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
        TPS22918
      </text>
      <text x={552} y={103} textAnchor="middle" fontSize="8.2" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
        5 V Load Switch
      </text>
      <text x={552} y={118} textAnchor="middle" fontSize="8.1" fontFamily="ui-monospace, monospace" fill={RED}>
        Extended (+€2.80 fee)
      </text>
      <Vcc x={552} y={62} label="+5V IN" />
      <line x1={630} y1={98} x2={698} y2={98} stroke={RED} strokeWidth={1.9} />
      <rect x={698} y={84} width={104} height={28} rx={4} fill="#fef2f2" stroke={RED} strokeWidth={1.3} />
      <text x={750} y={96} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight={700} fill={RED}>
        +5V_REL
      </text>
      <text x={750} y={106} textAnchor="middle" fontSize="7.6" fontFamily="ui-monospace, monospace" fill={W_MUTED}>
        REL1 / REL2
      </text>

      <line x1={436} y1={109} x2={436} y2={192} stroke={BLUE} strokeWidth={1.6} />
      <line x1={436} y1={192} x2={504} y2={192} stroke={BLUE} strokeWidth={1.6} />
      <NMosfet gx={504} cy={186} label="Q5 AO3400A" sub="Pump H3 Gate" />
      <Gnd x={526} y={204} />

      <text x={14} y={254} fontSize="8.5" fontFamily="ui-monospace, monospace" fill={RED}>
        Drawbacks: Fixed 1.6 s (0.9 s min) false-trips during normal 2–5 s Raspberry Pi Linux stalls · €5.60 extended fees
      </text>
    </svg>
  );
};
