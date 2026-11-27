import React from 'react';
import {
  HAT_DIMS,
  HatEdition,
  PlacedPart,
  SubsystemKey,
  getHatEditionSpec,
} from '../data/hatLayout';

import { ROUTED_PCB_DATA } from '../../08-FullHat/data/routedPcbData';

export type HatViewMode = 'pcb' | 'iso3d' | 'cad';
export type SolderMaskColor = 'green' | 'black' | 'blue';
export type BoardSimState = 'running' | 'standby' | 'wd_trip';

interface HatBoardSvgProps {
  edition: HatEdition;
  viewMode: HatViewMode;
  maskColor: SolderMaskColor;
  boardState: BoardSimState;
  showZones: boolean;
  showDnp: boolean;
  showRulers: boolean;
  showPiOutline: boolean;
  showCopper?: boolean;
  selectedPartId: string | null;
  highlightedZone: SubsystemKey | null;
  onSelectPart: (part: PlacedPart) => void;
}

const MASK_PALETTES: Record<
  SolderMaskColor,
  { board: string; boardEdge: string; copperTrace: string; agndPour: string; silk: string }
> = {
  green: {
    board: '#0f5c36',
    boardEdge: '#093c23',
    copperTrace: '#177546',
    agndPour: '#156b40',
    silk: '#f1f5f9',
  },
  black: {
    board: '#1a1f27',
    boardEdge: '#0b0e13',
    copperTrace: '#262d38',
    agndPour: '#222832',
    silk: '#e2e8f0',
  },
  blue: {
    board: '#144482',
    boardEdge: '#0c2b54',
    copperTrace: '#1c56a1',
    agndPour: '#194f94',
    silk: '#f1f5f9',
  },
};

function isLedLit(ref: string, state: BoardSimState): boolean {
  if (ref === 'D2') return true; // +5V_HAT PWR always on
  if (ref === 'D33') return true; // +V_DRV 9.1 V charge-pump OK
  if (ref === 'D34' || ref === 'D35') return true; // 1W-A / 1W-B post-R402/R404 VDD OK (goes dark on cable short)
  if (ref === 'D3') return state !== 'wd_trip'; // Green WD OK
  if (ref === 'D36') return state === 'wd_trip'; // Red WD FAULT (driven via Q23 AO3400A)
  if (ref === 'D12') return state === 'running'; // PUMP1 PWM active
  if (ref === 'D7') return state === 'running'; // REL1 SMD populated per D25 (energized when running, cut by Q12 on WD trip)
  return false;
}

// ============================================================================
// ISOMETRIC 3D PROJECTION HELPER (HAT mounted 16.5 mm above Raspberry Pi 5)
// ============================================================================
function isoProject(xMm: number, yMm: number, zMm: number): [number, number] {
  const originX = 365;
  const originY = 235;
  const sx = 6.2;
  const sy = 3.25;
  const sz = 4.6;
  const px = originX + (xMm - yMm) * sx;
  const py = originY + (xMm + yMm) * sy - zMm * sz;
  return [px, py];
}

function isoPts(pts: [number, number, number][]): string {
  return pts
    .map(([x, y, z]) => {
      const [px, py] = isoProject(x, y, z);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(' ');
}

function IsoBox({
  x,
  y,
  z,
  w,
  d,
  h,
  topFill,
  leftFill,
  rightFill,
  stroke = 'rgba(15,23,42,0.35)',
  strokeWidth = 0.7,
  onClick,
  cursor,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  topFill: string;
  leftFill: string;
  rightFill: string;
  stroke?: string;
  strokeWidth?: number;
  onClick?: () => void;
  cursor?: string;
}) {
  const top = isoPts([
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]);
  const frontLeft = isoPts([
    [x, y + d, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]);
  const frontRight = isoPts([
    [x + w, y, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x + w, y, z + h],
  ]);
  return (
    <g onClick={onClick} style={cursor ? { cursor } : undefined}>
      <polygon points={frontLeft} fill={leftFill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <polygon points={frontRight} fill={rightFill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <polygon points={top} fill={topFill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </g>
  );
}

export function HatBoardSvg({
  edition,
  viewMode,
  maskColor,
  boardState,
  showZones,
  showDnp,
  showRulers,
  showPiOutline,
  showCopper = false,
  selectedPartId,
  highlightedZone,
  onSelectPart,
}: HatBoardSvgProps) {
  const spec = getHatEditionSpec(edition);
  const routedBoard = ROUTED_PCB_DATA[edition];
  const palette = MASK_PALETTES[maskColor];
  const isAllPt = edition === 'all_pt1000';

  // ==========================================================================
  // VIEW 2: ISOMETRIC 3D HAT STACKED ON PASSIVELY COOLED RASPBERRY PI (11.0 mm)
  // ==========================================================================
  if (viewMode === 'iso3d') {
    const hatZ = 11.0;
    const piZ = 0;

    return (
      <svg
        viewBox="0 0 860 560"
        className="w-full h-auto block select-none bg-slate-950 rounded-md"
        role="img"
        aria-label={`Isometric 3D view of ${spec.silkTitle} mounted on Raspberry Pi 5`}
      >
        <defs>
          <radialGradient id="isoGlowGreen" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="isoGlowRed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle technical floor grid */}
        <g opacity="0.12" stroke="#64748b" strokeWidth="0.7">
          {Array.from({ length: 13 }).map((_, i) => (
            <line
              key={`gx-${i}`}
              x1={isoProject(i * 8 - 10, -10, -2)[0]}
              y1={isoProject(i * 8 - 10, -10, -2)[1]}
              x2={isoProject(i * 8 - 10, 68, -2)[0]}
              y2={isoProject(i * 8 - 10, 68, -2)[1]}
            />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line
              key={`gy-${i}`}
              x1={isoProject(-10, i * 8 - 6, -2)[0]}
              y1={isoProject(-10, i * 8 - 6, -2)[1]}
              x2={isoProject(92, i * 8 - 6, -2)[0]}
              y2={isoProject(92, i * 8 - 6, -2)[1]}
            />
          ))}
        </g>

        {/* ---- 1. RASPBERRY PI 5 BASE BOARD (85 x 56 mm, Z = 0..1.6 mm) ---- */}
        <IsoBox
          x={0}
          y={0}
          z={piZ}
          w={85}
          d={56}
          h={1.6}
          topFill="#14633a"
          leftFill="#0d4227"
          rightFill="#0a341e"
          stroke="#062214"
        />

        {/* Pi 5 Silver Ethernet + 2x Dual USB-A Ports (Right overhang X=66..85 mm) */}
        <IsoBox x={68} y={4} z={1.6} w={17.5} d={15.5} h={13.5} topFill="#cbd5e1" leftFill="#94a3b8" rightFill="#64748b" />
        <IsoBox x={69} y={22} z={1.6} w={16.5} d={13.5} h={14.5} topFill="#cbd5e1" leftFill="#94a3b8" rightFill="#64748b" />
        <IsoBox x={69} y={38} z={1.6} w={16.5} d={13.5} h={14.5} topFill="#cbd5e1" leftFill="#94a3b8" rightFill="#64748b" />
        <polygon
          points={isoPts([
            [85.6, 24.5, 4.2],
            [85.6, 33, 4.2],
            [85.6, 33, 6.2],
            [85.6, 24.5, 6.2],
          ])}
          fill="#2563eb"
        />
        <polygon
          points={isoPts([
            [85.6, 24.5, 10.5],
            [85.6, 33, 10.5],
            [85.6, 33, 12.5],
            [85.6, 24.5, 12.5],
          ])}
          fill="#2563eb"
        />

        {/* Passively Cooled Pi Low-Profile Aluminum Heatsink (h = 6.0 mm -> 3.4 mm air gap under 11 mm HAT) */}
        <IsoBox x={18} y={16} z={1.6} w={30} d={26} h={6.0} topFill="#94a3b8" leftFill="#64748b" rightFill="#475569" />
        {[19, 22.5, 26, 29.5, 33, 36.5, 40].map((fy) => (
          <polyline
            key={`fin-${fy}`}
            points={isoPts([
              [18.5, fy, 7.7],
              [47.5, fy, 7.7],
            ])}
            stroke="#334155"
            strokeWidth="1.1"
          />
        ))}

        {/* Pi 5 Front Edge USB-C & 2x micro-HDMI */}
        <IsoBox x={6} y={51.5} z={1.6} w={9} d={5} h={3.2} topFill="#cbd5e1" leftFill="#94a3b8" rightFill="#64748b" />
        <IsoBox x={20} y={52.2} z={1.6} w={6.5} d={4.2} h={2.8} topFill="#cbd5e1" leftFill="#94a3b8" rightFill="#64748b" />
        <IsoBox x={31} y={52.2} z={1.6} w={6.5} d={4.2} h={2.8} topFill="#cbd5e1" leftFill="#94a3b8" rightFill="#64748b" />

        {/* ---- 2. FOUR NON-CONDUCTIVE NYLON M2.5 11.0 mm STANDOFFS & STANDARD 40-PIN GPIO HEADER ---- */}
        {HAT_DIMS.mountingHoles.map((mh) => (
          <IsoBox
            key={`so-${mh.ref}`}
            x={mh.x - 1.4}
            y={mh.y - 1.4}
            z={1.6}
            w={2.8}
            d={2.8}
            h={hatZ - 1.6}
            topFill="#f8fafc"
            leftFill="#e2e8f0"
            rightFill="#cbd5e1"
            stroke="#64748b"
            strokeWidth={0.5}
          />
        ))}
        <IsoBox
          x={7.1}
          y={1.0}
          z={1.6}
          w={50.8}
          d={5.08}
          h={hatZ - 1.6}
          topFill="#1e293b"
          leftFill="#0f172a"
          rightFill="#020617"
        />

        {/* ---- 3. CoSTOS HAT PCB (65 x 56 mm, Z = 16.5..18.1 mm) ---- */}
        <IsoBox
          x={0}
          y={0}
          z={hatZ}
          w={65}
          d={56}
          h={1.6}
          topFill={palette.board}
          leftFill={palette.boardEdge}
          rightFill="#062917"
          stroke="#e2e8f0"
          strokeWidth={0.65}
        />

        {/* Quiet Kelvin AGND Sensor Zone outline on top of 3D HAT */}
        <polygon
          points={isoPts([
            [spec.agndRect.x, spec.agndRect.y, hatZ + 1.65],
            [spec.agndRect.x + spec.agndRect.w, spec.agndRect.y, hatZ + 1.65],
            [spec.agndRect.x + spec.agndRect.w, spec.agndRect.y + spec.agndRect.h, hatZ + 1.65],
            [spec.agndRect.x, spec.agndRect.y + spec.agndRect.h, hatZ + 1.65],
          ])}
          fill="rgba(56, 189, 248, 0.16)"
          stroke="#38bdf8"
          strokeWidth="1.0"
          strokeDasharray="3 2"
        />

        {/* Top 40-pin Stacking Header */}
        <IsoBox
          x={7.1}
          y={1.0}
          z={hatZ + 1.6}
          w={50.8}
          d={5.08}
          h={2.2}
          topFill="#334155"
          leftFill="#1e293b"
          rightFill="#0f172a"
        />

        {/* ---- 4. 3D GREEN FIXED RISING-CAGE SCREW TERMINALS (DG350 / DG350D) ---- */}
        {spec.parts
          .filter(
            (p) =>
              p.kind === 'terminal_left' ||
              p.kind === 'terminal_left_8p_fixed' ||
              p.kind === 'terminal_left_dual_fixed' ||
              p.kind === 'terminal_bottom'
          )
          .map((term) => {
            const isSel = selectedPartId === term.id;
            if (term.kind === 'terminal_left_dual_fixed') {
              // Authentic green stepped 2-tier DG350D-3.5-08P / MKKDS 1.5 fixed rising-cage screw block (0 mm overhang, H = 18.5 mm)
              const xLeft = term.x - term.w / 2;
              const yTop = term.y - term.h / 2;
              return (
                <g key={`iso-${term.id}`} onClick={() => onSelectPart(term)} className="cursor-pointer">
                  {/* Lower Tier (Bank B: PT5–PT8, Z = +1.6..+10.2 mm, full 10.0 mm depth) */}
                  <IsoBox
                    x={xLeft}
                    y={yTop}
                    z={hatZ + 1.6}
                    w={term.w}
                    d={term.h}
                    h={8.6}
                    topFill={isSel ? '#4ade80' : '#16a34a'}
                    leftFill="#15803d"
                    rightFill="#166534"
                    stroke={isSel ? '#fef08a' : '#052e16'}
                    strokeWidth={isSel ? 1.5 : 0.7}
                  />
                  {/* Lower Tier 8× M2 Silver Slotted Rising-Cage Screws (front terrace) */}
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const sy = term.y - 3.5 * 3.5 + idx * 3.5;
                    const [sx, sy2] = isoProject(xLeft + 2.3, sy, hatZ + 10.3);
                    return (
                      <g key={`lo-${idx}`}>
                        <ellipse cx={sx} cy={sy2} rx={3.6} ry={2.1} fill="#e2e8f0" stroke="#475569" strokeWidth="0.65" />
                        <line x1={sx - 2.3} y1={sy2 - 0.9} x2={sx + 2.3} y2={sy2 + 0.9} stroke="#334155" strokeWidth="0.9" />
                      </g>
                    );
                  })}
                  {/* Upper Tier (Bank A: PT1–PT4, stepped back inward, Z = +10.2..+18.5 mm) */}
                  <IsoBox
                    x={xLeft + 4.4}
                    y={yTop}
                    z={hatZ + 10.2}
                    w={term.w - 4.4}
                    d={term.h}
                    h={8.3}
                    topFill={isSel ? '#86efac' : '#22c55e'}
                    leftFill="#16a34a"
                    rightFill="#15803d"
                    stroke={isSel ? '#fef08a' : '#052e16'}
                    strokeWidth={isSel ? 1.5 : 0.7}
                  />
                  {/* Upper Tier 8× M2 Silver Slotted Rising-Cage Screws */}
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const sy = term.y - 3.5 * 3.5 + idx * 3.5;
                    const [sx, sy2] = isoProject(xLeft + 7.2, sy, hatZ + 18.6);
                    return (
                      <g key={`hi-${idx}`}>
                        <ellipse cx={sx} cy={sy2} rx={3.6} ry={2.1} fill="#e2e8f0" stroke="#475569" strokeWidth="0.65" />
                        <line x1={sx - 2.3} y1={sy2 - 0.9} x2={sx + 2.3} y2={sy2 + 0.9} stroke="#334155" strokeWidth="0.9" />
                      </g>
                    );
                  })}
                </g>
              );
            }
            if (term.kind === 'terminal_left_8p_fixed') {
              // Authentic green 8-pin DG350-3.5-08P / MKDS 1.5 fixed rising-cage screw block (0 mm overhang, H = 10.5 mm)
              return (
                <g key={`iso-${term.id}`} onClick={() => onSelectPart(term)} className="cursor-pointer">
                  <IsoBox
                    x={term.x - term.w / 2}
                    y={term.y - term.h / 2}
                    z={hatZ + 1.6}
                    w={term.w}
                    d={term.h}
                    h={8.9}
                    topFill={isSel ? '#4ade80' : '#16a34a'}
                    leftFill="#15803d"
                    rightFill="#166534"
                    stroke={isSel ? '#fef08a' : '#052e16'}
                    strokeWidth={isSel ? 1.5 : 0.7}
                  />
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const sy = term.y - 3.5 * 3.5 + idx * 3.5;
                    const [sx, sy2] = isoProject(term.x + 0.6, sy, hatZ + 10.6);
                    return (
                      <g key={idx}>
                        <ellipse cx={sx} cy={sy2} rx={3.8} ry={2.2} fill="#e2e8f0" stroke="#475569" strokeWidth="0.65" />
                        <line x1={sx - 2.4} y1={sy2 - 0.9} x2={sx + 2.4} y2={sy2 + 0.9} stroke="#334155" strokeWidth="0.9" />
                      </g>
                    );
                  })}
                </g>
              );
            }
            return (
              <g key={`iso-${term.id}`} onClick={() => onSelectPart(term)} className="cursor-pointer">
                <IsoBox
                  x={term.x - term.w / 2}
                  y={term.y - term.h / 2}
                  z={hatZ + 1.6}
                  w={term.w}
                  d={term.h}
                  h={8.9}
                  topFill={isSel ? '#4ade80' : '#16a34a'}
                  leftFill="#15803d"
                  rightFill="#166534"
                  stroke={isSel ? '#fef08a' : '#052e16'}
                  strokeWidth={isSel ? 1.5 : 0.7}
                />
                {(term.kind === 'terminal_left'
                  ? Array.from({ length: term.h > 9 ? 3 : 2 }).map((_, i) => ({
                      sx: term.x,
                      sy: term.y - ((term.h > 9 ? 1 : 0.5) - i) * 3.5,
                    }))
                  : Array.from({ length: term.w > 9 ? 3 : 2 }).map((_, i) => ({
                      sx: term.x - ((term.w > 9 ? 1 : 0.5) - i) * 3.5,
                      sy: term.y,
                    }))
                ).map((sc, idx) => {
                  const [cx, cy] = isoProject(sc.sx, sc.sy, hatZ + 10.6);
                  return (
                    <g key={idx}>
                      <ellipse cx={cx} cy={cy} rx={4.2} ry={2.4} fill="#e2e8f0" stroke="#475569" strokeWidth="0.7" />
                      <line x1={cx - 2.6} y1={cy - 1.0} x2={cx + 2.6} y2={cy + 1.0} stroke="#334155" strokeWidth="0.9" />
                    </g>
                  );
                })}
              </g>
            );
          })}

        {/* Optional DNP dashed outlines on 3D HAT */}
        {showDnp &&
          spec.parts
            .filter((p) => p.isDnp)
            .map((dnp) => (
              <polygon
                key={`iso-dnp-${dnp.id}`}
                points={isoPts([
                  [dnp.x - dnp.w / 2, dnp.y - dnp.h / 2, hatZ + 1.7],
                  [dnp.x + dnp.w / 2, dnp.y - dnp.h / 2, hatZ + 1.7],
                  [dnp.x + dnp.w / 2, dnp.y + dnp.h / 2, hatZ + 1.7],
                  [dnp.x - dnp.w / 2, dnp.y + dnp.h / 2, hatZ + 1.7],
                ])}
                fill="rgba(148,163,184,0.12)"
                stroke="#94a3b8"
                strokeWidth="0.9"
                strokeDasharray="3 2"
                onClick={() => onSelectPart(dnp)}
                className="cursor-pointer"
              />
            ))}

        {/* 3D Populated ICs, SMA Diodes, 1206 Power Parts, SOT-23s & JP1 Copper Pads */}
        {spec.parts
          .filter(
            (p) =>
              !p.isDnp &&
              (p.kind === 'ic_soic8' ||
                p.kind === 'diode_sma' ||
                p.kind === 'res_1206' ||
                p.kind === 'cap_1206' ||
                p.kind === 'sot23' ||
                p.kind === 'jumper' ||
                p.kind === 'test_pad')
          )
          .map((p) => {
            const isSel = selectedPartId === p.id;
            if (p.kind === 'test_pad') {
              const [tx, ty] = isoProject(p.x, p.y, hatZ + 1.75);
              return (
                <g key={`iso-tp-${p.id}`} onClick={() => onSelectPart(p)} style={{ cursor: 'pointer' }}>
                  <ellipse
                    cx={tx}
                    cy={ty}
                    rx={4.2}
                    ry={2.4}
                    fill={isSel ? '#38bdf8' : '#facc15'}
                    stroke={isSel ? '#fef08a' : '#854d0e'}
                    strokeWidth={isSel ? 1.4 : 0.7}
                  />
                </g>
              );
            }
            if (p.kind === 'jumper') {
              // Unpopulated 2-pad exposed copper/ENIG tweezer test point (flat flush on PCB)
              return (
                <g key={`iso-p-${p.id}`} onClick={() => onSelectPart(p)} style={{ cursor: 'pointer' }}>
                  <IsoBox
                    x={p.x - p.w / 2 + 0.4}
                    y={p.y - p.h / 2 + 0.35}
                    z={hatZ + 1.6}
                    w={1.9}
                    d={p.h - 0.7}
                    h={0.22}
                    topFill={isSel ? '#38bdf8' : '#eab308'}
                    leftFill="#ca8a04"
                    rightFill="#a16207"
                    stroke={isSel ? '#fef08a' : '#854d0e'}
                    strokeWidth={isSel ? 1.1 : 0.4}
                  />
                  <IsoBox
                    x={p.x + 0.4}
                    y={p.y - p.h / 2 + 0.35}
                    z={hatZ + 1.6}
                    w={1.9}
                    d={p.h - 0.7}
                    h={0.22}
                    topFill={isSel ? '#38bdf8' : '#eab308'}
                    leftFill="#ca8a04"
                    rightFill="#a16207"
                    stroke={isSel ? '#fef08a' : '#854d0e'}
                    strokeWidth={isSel ? 1.1 : 0.4}
                  />
                </g>
              );
            }
            const h =
              p.kind === 'diode_sma' ? 2.1 : p.kind === 'ic_soic8' ? 1.8 : 1.1;
            const topFill =
              p.kind === 'cap_1206'
                ? '#b45309'
                : p.kind === 'res_1206'
                  ? '#1e293b'
                  : '#0f172a';
            return (
              <IsoBox
                key={`iso-p-${p.id}`}
                x={p.x - p.w / 2}
                y={p.y - p.h / 2}
                z={hatZ + 1.6}
                w={p.w}
                d={p.h}
                h={h}
                topFill={isSel ? '#38bdf8' : topFill}
                leftFill="#090d16"
                rightFill="#1e293b"
                stroke={isSel ? '#fef08a' : '#475569'}
                strokeWidth={isSel ? 1.3 : 0.45}
                onClick={() => onSelectPart(p)}
                cursor="pointer"
              />
            );
          })}

        {/* 3D Glowing Diagnostic LEDs (Green + Red D36 WD FAULT) */}
        {spec.parts
          .filter((p) => p.kind === 'led_green' || p.kind === 'led_red')
          .map((led) => {
            const lit = isLedLit(led.ref, boardState);
            const isRed = led.kind === 'led_red';
            const [lx, ly] = isoProject(led.x, led.y, hatZ + 2.4);
            return (
              <g key={`iso-led-${led.id}`} onClick={() => onSelectPart(led)} className="cursor-pointer">
                {lit && (
                  <circle
                    cx={lx}
                    cy={ly}
                    r={13}
                    fill={isRed ? 'url(#isoGlowRed)' : 'url(#isoGlowGreen)'}
                  />
                )}
                <circle
                  cx={lx}
                  cy={ly}
                  r={3.5}
                  fill={lit ? (isRed ? '#f87171' : '#4ade80') : '#334155'}
                  stroke="#0f172a"
                  strokeWidth="0.7"
                />
              </g>
            );
          })}

        {/* ---- 5. CLEAN TECHNICAL CALLOUT LEADERS ---- */}
        {(() => {
          const [sX, sY] = isoProject(1.5, 26, hatZ + 10);
          const [aX, aY] = isoProject(16, 55, hatZ + 6);
          const [uX, uY] = isoProject(79, 25, 11);
          const [cX, cY] = isoProject(42, 42, 8);
          const [lX, lY] = isoProject(62, 19.5, hatZ + 2.5);
          return (
            <g className="font-mono">
              <line x1={sX} y1={sY} x2={68} y2={252} stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 2" />
              <circle cx={sX} cy={sY} r="3" fill="#38bdf8" />
              <text x="20" y="236" fill="#4ade80" fontSize="11.5" fontWeight="700">
                {isAllPt ? '8× PT1000 · DG350D 2×8P SCREW' : 'QUIET LEFT EDGE · DG350 8P SCREW'}
              </text>
              <text x="20" y="250" fill="#cbd5e1" fontSize="10">
                {isAllPt
                  ? 'J6: Upper PT1–4 · Lower PT5–8 (2-Tier)'
                  : 'J6: PT1± (1–2) · 1W-A (3–5) · 1W-B (6–8)'}
              </text>
              <text x="20" y="263" fill="#94a3b8" fontSize="9.5">
                3.50 mm M2 rising-cage · 0 mm overhang
              </text>

              <line x1={aX} y1={aY} x2={225} y2={488} stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="3 2" />
              <circle cx={aX} cy={aY} r="3" fill="#a78bfa" />
              <text x="44" y="486" fill="#c4b5fd" fontSize="11.5" fontWeight="700">
                FRONT ACTUATOR EDGE (REL1 SMD POP.)
              </text>
              <text x="44" y="500" fill="#cbd5e1" fontSize="10">
                J2 PUMP1 (7.55V PWM + FB1) · J4 REL1 THT Opt.
              </text>
              <text x="44" y="513" fill="#94a3b8" fontSize="9.5">
                REL1 SMD factory-fitted (D25) · J3/J5 DNP
              </text>

              <line x1={cX} y1={cY} x2={590} y2={482} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" />
              <circle cx={cX} cy={cY} r="3" fill="#f59e0b" />
              <text x="596" y="478" fill="#fbbf24" fontSize="11" fontWeight="700">
                11.0 mm NORMAL STACK HEIGHT
              </text>
              <text x="596" y="492" fill="#cbd5e1" fontSize="9.8">
                Clears passive Pi heatsink; 65 mm stops clear of USB/Eth
              </text>

              <line x1={uX} y1={uY} x2={720} y2={352} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
              <circle cx={uX} cy={uY} r="3" fill="#94a3b8" />
              <text x="660" y="346" fill="#e2e8f0" fontSize="10.5" fontWeight="700">
                PI 5 USB / ETH CLEAR
              </text>
              <text x="660" y="360" fill="#94a3b8" fontSize="9.5">
                Zero HAT cables on right edge
              </text>

              <line x1={lX} y1={lY} x2={695} y2={155} stroke="#4ade80" strokeWidth="1.2" strokeDasharray="3 2" />
              <circle cx={lX} cy={lY} r="3" fill="#4ade80" />
              <text x="660" y="140" fill="#4ade80" fontSize="10.5" fontWeight="700">
                {isAllPt ? '6× DIAGNOSTIC LEDs' : '8× DIAGNOSTIC LEDs'}
              </text>
              <text x="660" y="154" fill="#cbd5e1" fontSize="9.5">
                {isAllPt ? 'PWR · +V_DRV · WD · RED FLT · PWM · REL1' : 'PWR · +V_DRV · 1W-A/B · WD · FLT · PWM · REL1'}
              </text>
            </g>
          );
        })()}
      </svg>
    );
  }

  // ==========================================================================
  // VIEWS 1 & 3: TOP-DOWN MILLIMETER-ACCURATE PCB / CAD FLOORPLAN (10 px = 1 mm)
  // ==========================================================================
  const S = 10; // 10 SVG units per 1.0 mm -> 65 mm = 650 px, 56 mm = 560 px
  const ox = 85;
  const oy = 52;
  const isCad = viewMode === 'cad';

  return (
    <svg
      viewBox="0 0 920 675"
      className={`w-full h-auto block select-none rounded-md ${isCad ? 'bg-slate-950' : 'bg-slate-100'}`}
      role="img"
      aria-label={`Top-down millimeter-accurate ${spec.silkTitle} PCB layout`}
    >
      <defs>
        <radialGradient id="ledGlowGreen" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ledGlowRed" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f87171" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <pattern id="agndHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.35" />
        </pattern>
        <filter id="boardShadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Optional Raspberry Pi 5 Silhouette underneath (85 x 56 mm) */}
      {showPiOutline && (
        <g>
          <rect
            x={ox}
            y={oy}
            width={85 * S}
            height={56 * S}
            rx={3 * S}
            fill={isCad ? 'rgba(30,41,59,0.45)' : 'rgba(148,163,184,0.18)'}
            stroke={isCad ? '#475569' : '#94a3b8'}
            strokeWidth="1.4"
            strokeDasharray="6 4"
          />
          <rect
            x={ox + 68 * S}
            y={oy + 4 * S}
            width={18.5 * S}
            height={15 * S}
            rx="3"
            fill={isCad ? 'rgba(148,163,184,0.12)' : 'rgba(203,213,225,0.65)'}
            stroke="#64748b"
            strokeWidth="1.2"
          />
          <text
            x={ox + 77 * S}
            y={oy + 12.2 * S}
            textAnchor="middle"
            className="font-mono"
            fontSize="10.5"
            fontWeight="700"
            fill={isCad ? '#94a3b8' : '#475569'}
          >
            GbE RJ45
          </text>
          <rect
            x={ox + 69 * S}
            y={oy + 22 * S}
            width={17.5 * S}
            height={13.5 * S}
            rx="3"
            fill={isCad ? 'rgba(59,130,246,0.14)' : 'rgba(191,219,254,0.65)'}
            stroke="#3b82f6"
            strokeWidth="1.2"
          />
          <text
            x={ox + 77.5 * S}
            y={oy + 29.4 * S}
            textAnchor="middle"
            className="font-mono"
            fontSize="10.5"
            fontWeight="700"
            fill={isCad ? '#93c5fd' : '#1d4ed8'}
          >
            USB 3.0
          </text>
          <rect
            x={ox + 69 * S}
            y={oy + 38 * S}
            width={17.5 * S}
            height={13.5 * S}
            rx="3"
            fill={isCad ? 'rgba(148,163,184,0.12)' : 'rgba(203,213,225,0.65)'}
            stroke="#64748b"
            strokeWidth="1.2"
          />
          <text
            x={ox + 77.5 * S}
            y={oy + 45.4 * S}
            textAnchor="middle"
            className="font-mono"
            fontSize="10.5"
            fontWeight="700"
            fill={isCad ? '#94a3b8' : '#475569'}
          >
            USB 2.0
          </text>
          <text
            x={ox + 75.5 * S}
            y={oy + 54.6 * S}
            textAnchor="middle"
            className="font-mono"
            fontSize="9.2"
            fill="#64748b"
          >
            Pi 5 (85×56 mm)
          </text>
        </g>
      )}

      {/* ---- MAIN 65.0 x 56.0 mm CoSTOS HAT PCB SUBSTRATE ---- */}
      <g filter={isCad ? undefined : 'url(#boardShadow)'}>
        <rect
          x={ox}
          y={oy}
          width={HAT_DIMS.widthMm * S}
          height={HAT_DIMS.heightMm * S}
          rx={HAT_DIMS.cornerRadiusMm * S}
          fill={isCad ? '#0b1220' : palette.board}
          stroke={isCad ? '#38bdf8' : palette.boardEdge}
          strokeWidth={isCad ? 2.2 : 3.5}
        />
      </g>

      {/* Subtle internal copper traces & Kelvin AGND island */}
      {!isCad && (
        <g opacity="0.65">
          {/* Quiet Kelvin AGND copper island (adapts to 1-Wire vs Full-Left All-Pt1000!) */}
          <rect
            x={ox + (spec.agndRect.x + 6.6) * S}
            y={oy + (spec.agndRect.y + 0.6) * S}
            width={(spec.agndRect.w - 6.8) * S}
            height={(spec.agndRect.h - 1.0) * S}
            rx="8"
            fill={palette.agndPour}
            stroke={palette.copperTrace}
            strokeWidth="1.2"
          />
          {/* Power & signal copper highways */}
          <path
            d={`M ${ox + 10.5 * S} ${oy + 4.8 * S} L ${ox + 14.0 * S} ${oy + 10.4 * S} L ${ox + 29.2 * S} ${oy + 10.4 * S} L ${ox + 50.6 * S} ${oy + 13.6 * S}`}
            fill="none"
            stroke={palette.copperTrace}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M ${ox + 29.2 * S} ${oy + 13.0 * S} L ${ox + 29.2 * S} ${oy + 28.5 * S} L ${ox + 49.2 * S} ${oy + 28.5 * S}`}
            fill="none"
            stroke={palette.copperTrace}
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M ${ox + 55.2 * S} ${oy + 30.8 * S} L ${ox + 55.2 * S} ${oy + 35.5 * S} L ${ox + 32.4 * S} ${oy + 35.5 * S} L ${ox + 32.4 * S} ${oy + 44.0 * S}`}
            fill="none"
            stroke={palette.copperTrace}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* J2 PUMP1 copper feed */}
          <path
            d={`M ${ox + 15.2 * S} ${oy + 48.0 * S} L ${ox + 37.2 * S} ${oy + 44.2 * S}`}
            fill="none"
            stroke={palette.copperTrace}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Shared PT_V_DIV excitation bus feeding Dual-Tier J6 in All-Pt1000 Edition */}
          {isAllPt && (
            <path
              d={`M ${ox + 16.0 * S} ${oy + 14.2 * S} L ${ox + 9.2 * S} ${oy + 14.2 * S} L ${ox + 9.2 * S} ${oy + 41.5 * S}`}
              fill="none"
              stroke={palette.copperTrace}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      )}

      {/* Real 2-Layer KiCad Routed Copper Overlay (F.Cu orange + B.Cu cyan + stitched vias) */}
      {showCopper && (() => {
        const bSig: string[] = [];
        const bPwr: string[] = [];
        const fSig: string[] = [];
        const fPwr: string[] = [];
        for (const [, layer, x1, y1, x2, y2, w] of routedBoard.segments) {
          const cmd = `M${(ox + x1 * S).toFixed(1)},${(oy + y1 * S).toFixed(1)}L${(ox + x2 * S).toFixed(1)},${(oy + y2 * S).toFixed(1)}`;
          const isPwr = w >= 0.22;
          if (layer === 1) {
            (isPwr ? bPwr : bSig).push(cmd);
          } else {
            (isPwr ? fPwr : fSig).push(cmd);
          }
        }
        return (
          <g pointerEvents="none" opacity={isCad ? 0.92 : 0.78}>
            {/* B.Cu (Bottom Layer) */}
            {bSig.length > 0 && (
              <path d={bSig.join('')} fill="none" stroke="#38bdf8" strokeWidth={0.18 * S} strokeLinecap="round" opacity="0.82" />
            )}
            {bPwr.length > 0 && (
              <path d={bPwr.join('')} fill="none" stroke="#0ea5e9" strokeWidth={0.24 * S} strokeLinecap="round" opacity="0.9" />
            )}
            {/* F.Cu (Top Layer) */}
            {fSig.length > 0 && (
              <path d={fSig.join('')} fill="none" stroke="#fb923c" strokeWidth={0.18 * S} strokeLinecap="round" opacity="0.9" />
            )}
            {fPwr.length > 0 && (
              <path d={fPwr.join('')} fill="none" stroke="#f97316" strokeWidth={0.24 * S} strokeLinecap="round" opacity="0.95" />
            )}
            {/* Stitched Through-Hole Vias (0.55 mm OD / 0.30 mm drill) */}
            {routedBoard.vias.map(([, vx, vy], idx) => (
              <g key={`via-${idx}`}>
                <circle cx={ox + vx * S} cy={oy + vy * S} r={0.275 * S} fill="#eab308" stroke="#713f12" strokeWidth="0.4" />
                <circle cx={ox + vx * S} cy={oy + vy * S} r={0.15 * S} fill="#0f172a" />
              </g>
            ))}
          </g>
        );
      })()}

      {/* CAD Mode: Dedicated Kelvin AGND Pour + High-Current Power Highways */}
      {isCad && (
        <g>
          <rect
            x={ox + spec.agndRect.x * S}
            y={oy + spec.agndRect.y * S}
            width={spec.agndRect.w * S}
            height={spec.agndRect.h * S}
            rx="6"
            fill="url(#agndHatch)"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />
          {/* Kelvin AGND Star Return directly to Pi Pins 9/14 */}
          <path
            d={`M ${ox + 21.0 * S} ${oy + spec.agndRect.y * S} L ${ox + 21.0 * S} ${oy + 6.2 * S}`}
            stroke="#38bdf8"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <text
            x={ox + 21.8 * S}
            y={oy + 9.2 * S}
            className="font-mono"
            fontSize="8.5"
            fontWeight="700"
            fill="#7dd3fc"
          >
            Kelvin AGND -&gt; Pin 9/14
          </text>

          {/* High-Current +5V_HAT & +V_DRV Highways (D18 Direct +5V_HAT -> Q12 +5V_REL) */}
          <path
            d={`M ${ox + 10.8 * S} ${oy + 6.0 * S} L ${ox + 14.0 * S} ${oy + 10.4 * S} L ${ox + 29.2 * S} ${oy + 10.4 * S}`}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="3.5"
          />
          <path
            d={`M ${ox + 55.2 * S} ${oy + 30.8 * S} L ${ox + 55.2 * S} ${oy + 35.8 * S} L ${ox + 30.0 * S} ${oy + 35.8 * S} L ${ox + 30.0 * S} ${oy + 43.8 * S}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
          />
          {isAllPt && (
            <path
              d={`M ${ox + 14.8 * S} ${oy + 15.2 * S} L ${ox + 8.0 * S} ${oy + 15.2 * S} L ${ox + 8.0 * S} ${oy + 47.0 * S} L ${ox + 20.8 * S} ${oy + 47.0 * S}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.4"
              strokeDasharray="4 2"
            />
          )}
        </g>
      )}

      {/* ---- SILKSCREEN BOARD TITLE & DIVIDER LINES ---- */}
      <g opacity={isCad ? 0.9 : 0.88} fill={palette.silk} className="font-mono">
        <text x={ox + 26.2 * S} y={oy + 22.8 * S} fontSize="10.6" fontWeight="700" letterSpacing="0.3">
          {spec.silkTitle}
        </text>
        <text x={ox + 26.2 * S} y={oy + 24.4 * S} fontSize="7.6" opacity="0.85">
          {spec.silkSubtitle}
        </text>
        <line
          x1={ox + 24.8 * S}
          y1={oy + 19.6 * S}
          x2={ox + 24.8 * S}
          y2={oy + 46.8 * S}
          stroke={palette.silk}
          strokeWidth="0.9"
          strokeDasharray="3 2"
          opacity="0.55"
        />
      </g>

      {/* ---- SUBSYSTEM ZONE OVERLAYS ---- */}
      {(showZones || isCad) &&
        spec.zones.map((z) => {
          const isHl = highlightedZone === z.id;
          return (
            <g key={`zone-${z.id}`}>
              <rect
                x={ox + z.x * S}
                y={oy + z.y * S}
                width={z.w * S}
                height={z.h * S}
                rx="5"
                fill={z.fill}
                stroke={z.stroke}
                strokeWidth={isHl ? 2.4 : 1.3}
                strokeDasharray={isHl ? undefined : '4 2.5'}
              />
              <rect
                x={ox + z.x * S + 3}
                y={oy + z.y * S + 3}
                width={z.shortTitle.length * 5.6 + 8}
                height="13"
                rx="2"
                fill="rgba(15,23,42,0.84)"
              />
              <text
                x={ox + z.x * S + 7}
                y={oy + z.y * S + 12.2}
                className="font-mono"
                fontSize="8.1"
                fontWeight="700"
                fill="#f8fafc"
              >
                {z.shortTitle}
              </text>
            </g>
          );
        })}

      {/* ---- 4× M2.5 GROUNDED MOUNTING HOLES (H1-H4) ---- */}
      {HAT_DIMS.mountingHoles.map((mh) => (
        <g key={mh.ref}>
          <circle cx={ox + mh.x * S} cy={oy + mh.y * S} r={2.7 * S} fill="#eab308" stroke="#a16207" strokeWidth="1" />
          <circle
            cx={ox + mh.x * S}
            cy={oy + mh.y * S}
            r={1.375 * S}
            fill={isCad ? '#020617' : '#e2e8f0'}
            stroke="#475569"
            strokeWidth="0.9"
          />
          <text
            x={ox + mh.x * S}
            y={oy + mh.y * S + (mh.y < 10 ? 4.3 * S : -3.4 * S)}
            textAnchor="middle"
            className="font-mono"
            fontSize="7.8"
            fontWeight="700"
            fill={palette.silk}
          >
            {mh.ref}
          </text>
        </g>
      ))}

      {/* ---- SUPPORT PASSIVES ---- */}
      <g opacity={isCad ? 0.55 : 0.95}>
        {spec.supportPassives.map((sp, i) => {
          const cx = ox + sp.x * S;
          const cy = oy + sp.y * S;
          if (sp.kind === 'c') {
            return (
              <g key={`sp-${i}`}>
                <rect x={cx - 10} y={cy - 5.5} width={20} height={11} rx="1.2" fill="#cbd5e1" />
                <rect x={cx - 6.5} y={cy - 5.5} width={13} height={11} fill="#b45309" />
              </g>
            );
          }
          if (sp.kind === 'd') {
            return (
              <g key={`sp-${i}`}>
                <rect x={cx - 12} y={cy - 4.5} width={24} height={9} rx="1" fill="#cbd5e1" />
                <rect x={cx - 8} y={cy - 5} width={16} height={10} rx="1" fill="#1e293b" />
                <rect x={cx - 7} y={cy - 5} width={2.8} height={10} fill="#e2e8f0" />
              </g>
            );
          }
          return (
            <g key={`sp-${i}`}>
              <rect x={cx - 10} y={cy - 5.2} width={20} height={10.4} rx="1.2" fill="#cbd5e1" />
              <rect x={cx - 6.5} y={cy - 5.2} width={13} height={10.4} fill="#0f172a" />
            </g>
          );
        })}
      </g>

      {/* ---- INTERACTIVE PLACED COMPONENTS ---- */}
      {spec.parts.map((p) => {
        if (p.isDnp && !showDnp) return null;
        const cx = ox + p.x * S;
        const cy = oy + p.y * S;
        const pw = p.w * S;
        const ph = p.h * S;
        const isSel = selectedPartId === p.id;
        const selRing = isSel ? (
          <rect
            x={cx - pw / 2 - 4}
            y={cy - ph / 2 - 4}
            width={pw + 8}
            height={ph + 8}
            rx="4"
            fill="none"
            stroke="#facc15"
            strokeWidth="2.4"
          />
        ) : null;

        // 1. 40-Pin Raspberry Pi Header (J1)
        if (p.kind === 'pi_header') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx="3"
                fill="#111827"
                stroke="#475569"
                strokeWidth="1.3"
              />
              {Array.from({ length: 20 }).map((_, col) => {
                const px = cx - pw / 2 + 12.7 + col * 25.4;
                return (
                  <g key={col}>
                    <circle cx={px} cy={cy - 12.7} r="4.8" fill="#eab308" />
                    <circle cx={px} cy={cy - 12.7} r="2.2" fill="#0f172a" />
                    {col === 0 ? (
                      <rect x={px - 5} y={cy + 7.7} width="10" height="10" fill="#facc15" />
                    ) : (
                      <circle cx={px} cy={cy + 12.7} r="4.8" fill="#eab308" />
                    )}
                    <circle cx={px} cy={cy + 12.7} r="2.2" fill="#0f172a" />
                  </g>
                );
              })}
              <text x={cx - pw / 2 + 8} y={cy + ph / 2 + 11} className="font-mono" fontSize="8" fontWeight="700" fill={palette.silk}>
                Pin 1 (+3V3)
              </text>
              <text x={cx + pw / 2 - 4} y={cy + ph / 2 + 11} textAnchor="end" className="font-mono" fontSize="8" fontWeight="700" fill={palette.silk}>
                Pin 40
              </text>
            </g>
          );
        }

        // 2a. Dual-Tier 2×8P (16-Pin) 3.50 mm Fixed Rising-Cage Screw Terminal (DG350D-3.5-08P / MKKDS 1.5 — All-Pt1000 J6)
        if (p.kind === 'terminal_left_dual_fixed') {
          const leftX = cx - pw / 2;
          const topY = cy - ph / 2;
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              {/* Outer Green 2-Tier Stepped Housing (0 mm Edge Overhang) */}
              <rect
                x={leftX}
                y={topY}
                width={pw}
                height={ph}
                rx="3"
                fill="#16a34a"
                stroke="#052e16"
                strokeWidth="1.8"
              />
              {/* Left Dual-Tier Wire-Entry Shroud */}
              <rect x={leftX} y={topY + 3} width="16" height={ph - 6} rx="1.5" fill="#14532d" />
              {/* Stepped Upper-Tier Terrace (Right Half of DG350D / MKKDS 1.5) */}
              <rect
                x={leftX + pw * 0.48}
                y={topY + 2}
                width={pw * 0.52 - 2}
                height={ph - 4}
                rx="2"
                fill="#22c55e"
                stroke="#14532d"
                strokeWidth="1.0"
              />
              {/* 8 Rows × 3.50 mm Pitch: Wire Port + Lower-Tier M2 Screw + Upper-Tier M2 Screw */}
              {Array.from({ length: 8 }).map((_, idx) => {
                const py = cy + (idx - 3.5) * 35;
                const lowerSx = leftX + 32;
                const upperSx = leftX + 68;
                const pairIdx = Math.floor(idx / 2) + 1;
                const pol = idx % 2 === 0 ? '+' : '−';
                const pinText = `${pairIdx}${pol}/${pairIdx + 4}${pol}`;
                return (
                  <g key={idx}>
                    {/* Wire funnel port */}
                    <rect x={leftX + 2.5} y={py - 8.5} width="11" height="17" rx="1.5" fill="#052e16" stroke="#4ade80" strokeWidth="0.6" />
                    {/* Lower-tier M2 slotted rising-cage screw */}
                    <circle cx={lowerSx} cy={py + 3} r="8.8" fill="#e2e8f0" stroke="#475569" strokeWidth="1.1" />
                    <line x1={lowerSx - 5.4} y1={py - 0.3} x2={lowerSx + 5.4} y2={py + 6.3} stroke="#334155" strokeWidth="1.8" />
                    {/* Upper-tier M2 slotted rising-cage screw (stepped inward) */}
                    <circle cx={upperSx} cy={py - 3} r="8.8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.1" />
                    <line x1={upperSx - 5.4} y1={py - 6.3} x2={upperSx + 5.4} y2={py + 0.3} stroke="#1e293b" strokeWidth="1.8" />
                    {/* Pin silkscreen legend */}
                    <text
                      x={leftX + pw - 3}
                      y={py + 3}
                      textAnchor="end"
                      className="font-mono"
                      fontSize="6.4"
                      fontWeight="700"
                      fill="#052e16"
                    >
                      {pinText}
                    </text>
                  </g>
                );
              })}
              <text
                x={cx + 8}
                y={topY - 6}
                textAnchor="middle"
                className="font-mono"
                fontSize="8.0"
                fontWeight="700"
                fill="#86efac"
              >
                J6 · 2×8P DG350D (PT1–8)
              </text>
            </g>
          );
        }

        // 2b. Combined 8-Pin 3.50 mm Fixed Rising-Cage Screw Terminal (DG350-3.5-08P / MKDS 1.5 — 1-Wire J6)
        if (p.kind === 'terminal_left_8p_fixed') {
          const leftX = cx - pw / 2;
          const topY = cy - ph / 2;
          const pinLabels = ['PT1+', 'PT1−', 'A5V', 'ADQ', 'AG', 'B5V', 'BDQ', 'BG'];
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect
                x={leftX}
                y={topY}
                width={pw}
                height={ph}
                rx="3"
                fill="#16a34a"
                stroke="#052e16"
                strokeWidth="1.8"
              />
              {/* Left Wire-Entry Funnel Strip (0 mm Edge Overhang) */}
              <rect x={leftX} y={topY + 3} width="16" height={ph - 6} rx="1.5" fill="#14532d" />
              {/* Subtle Group Divider Lines between PT1 (1–2), 1W-A (3–5), and 1W-B (6–8) */}
              {[1.5, 4.5].map((boundary) => {
                const divY = cy + (boundary - 3.5) * 35;
                return (
                  <line
                    key={boundary}
                    x1={leftX + 16}
                    y1={divY}
                    x2={leftX + pw - 2}
                    y2={divY}
                    stroke="#bbf7d0"
                    strokeWidth="0.9"
                    strokeDasharray="3 2"
                  />
                );
              })}
              {pinLabels.map((lbl, idx) => {
                const py = cy + (idx - 3.5) * 35;
                const sx = leftX + 41;
                return (
                  <g key={idx}>
                    <rect x={leftX + 2.5} y={py - 8} width="11" height="16" rx="1.5" fill="#052e16" stroke="#4ade80" strokeWidth="0.6" />
                    <circle cx={sx} cy={py} r="9.8" fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
                    <line x1={sx - 6.0} y1={py - 3.6} x2={sx + 6.0} y2={py + 3.6} stroke="#334155" strokeWidth="2.0" />
                    <text
                      x={leftX + pw - 3}
                      y={py + 3}
                      textAnchor="end"
                      className="font-mono"
                      fontSize="6.8"
                      fontWeight="700"
                      fill="#ecfdf5"
                    >
                      {lbl}
                    </text>
                  </g>
                );
              })}
              <text
                x={cx + 8}
                y={topY - 6}
                textAnchor="middle"
                className="font-mono"
                fontSize="8.0"
                fontWeight="700"
                fill="#86efac"
              >
                J6 · 8P DG350 (PT1 / 1W-A / 1W-B)
              </text>
            </g>
          );
        }

        // 2c. Standard 3.50 mm Fixed Rising-Cage Screw Terminals (J2 DG350-3.5-03P)
        if (p.kind === 'terminal_left' || p.kind === 'terminal_bottom') {
          const isLeft = p.kind === 'terminal_left';
          const pinCount = (isLeft ? p.h : p.w) > 9 ? 3 : 2;
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx="3"
                fill="#16a34a"
                stroke="#052e16"
                strokeWidth="1.6"
              />
              {isLeft ? (
                <rect
                  x={cx - pw / 2}
                  y={cy - ph / 2 + 3}
                  width="14"
                  height={ph - 6}
                  rx="1.5"
                  fill="#14532d"
                />
              ) : (
                <rect
                  x={cx - pw / 2 + 3}
                  y={cy + ph / 2 - 14}
                  width={pw - 6}
                  height="14"
                  rx="1.5"
                  fill="#14532d"
                />
              )}
              {Array.from({ length: pinCount }).map((_, idx) => {
                const offset = (idx - (pinCount - 1) / 2) * 35;
                const sx = isLeft ? cx + 8 : cx + offset;
                const sy = isLeft ? cy + offset : cy - 8;
                const j2Pins = ['PWM', 'GND', 'FB1'];
                return (
                  <g key={idx}>
                    <circle cx={sx} cy={sy} r="10.2" fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
                    <line x1={sx - 6.2} y1={sy - 3.8} x2={sx + 6.2} y2={sy + 3.8} stroke="#334155" strokeWidth="2.0" />
                    {!isLeft && p.ref === 'J2' && j2Pins[idx] && (
                      <text
                        x={sx}
                        y={cy + ph / 2 - 4}
                        textAnchor="middle"
                        className="font-mono"
                        fontSize="6.6"
                        fontWeight="700"
                        fill="#ecfdf5"
                      >
                        {j2Pins[idx]}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={isLeft ? cx + pw / 2 + 4 : cx}
                y={isLeft ? cy + 3 : cy - ph / 2 - 5}
                textAnchor={isLeft ? 'start' : 'middle'}
                className="font-mono"
                fontSize="8.6"
                fontWeight="700"
                fill="#f8fafc"
              >
                {p.ref === 'J2' ? 'J2 PUMP1 (1:PWM 2:GND 3:FB1)' : `${p.ref} ${p.label.split(' ')[0]}`}
              </text>
            </g>
          );
        }

        // 3. DNP / Optional Unpopulated Footprints (Optional J4 THT, DNP J3/J5 Terminals & Future ICs)
        if (p.kind === 'dnp_terminal' || p.kind === 'dnp_ic' || p.kind === 'dnp_smd') {
          const isSmd = p.kind === 'dnp_smd';
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer" opacity={isSmd ? 0.8 : 0.88}>
              {selRing}
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx={isSmd ? '1.5' : '3'}
                fill="rgba(15,23,42,0.28)"
                stroke="#cbd5e1"
                strokeWidth={isSmd ? '1.0' : '1.3'}
                strokeDasharray={isSmd ? '2.5 2' : '4 2.5'}
              />
              {p.kind === 'dnp_terminal' &&
                Array.from({ length: p.w > 9 ? 3 : 2 }).map((_, i) => {
                  const px = cx + (i - (p.w > 9 ? 1 : 0.5)) * 35;
                  return (
                    <g key={i}>
                      <circle cx={px} cy={cy} r="7.5" fill="#eab308" opacity="0.75" />
                      <circle cx={px} cy={cy} r="3.8" fill="#0f172a" />
                    </g>
                  );
                })}
              {isSmd && (
                <>
                  <rect x={cx - pw / 2 + 2} y={cy - ph / 2 + 2} width="5" height={ph - 4} fill="#eab308" opacity="0.65" />
                  <rect x={cx + pw / 2 - 7} y={cy - ph / 2 + 2} width="5" height={ph - 4} fill="#eab308" opacity="0.65" />
                </>
              )}
              <text
                x={cx}
                y={p.kind === 'dnp_terminal' ? cy - ph / 2 - 5 : isSmd ? cy + ph / 2 + 8.5 : cy + 3}
                textAnchor="middle"
                className="font-mono"
                fontSize={isSmd ? '6.4' : p.kind === 'dnp_terminal' ? '7.2' : '7.4'}
                fontWeight="700"
                fill="#cbd5e1"
              >
                {p.kind === 'dnp_terminal'
                  ? `${p.ref} ${p.label.split(' ')[0]} (DNP)`
                  : p.kind === 'dnp_ic'
                    ? `${p.ref} ${p.label.split(' ')[0]} DNP`
                    : `${p.ref} DNP`}
              </text>
            </g>
          );
        }

        // 4. SOIC-8 LM393DR ICs (U1, U3, U4)
        if (p.kind === 'ic_soic8') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              {Array.from({ length: 4 }).map((_, i) => {
                const ly = cy - ph / 2 + 9 + i * 13.2;
                return (
                  <g key={i}>
                    <rect x={cx - pw / 2 - 9} y={ly - 3} width="11" height="6" rx="1" fill="#cbd5e1" />
                    <rect x={cx + pw / 2 - 2} y={ly - 3} width="11" height="6" rx="1" fill="#cbd5e1" />
                  </g>
                );
              })}
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx="2.5"
                fill="#111827"
                stroke="#475569"
                strokeWidth="1.2"
              />
              <circle cx={cx - pw / 2 + 8} cy={cy - ph / 2 + 8} r="2.6" fill="#94a3b8" />
              <text x={cx} y={cy - 2} textAnchor="middle" className="font-mono" fontSize="8.5" fontWeight="700" fill="#e2e8f0">
                {p.ref}
              </text>
              <text x={cx} y={cy + 9} textAnchor="middle" className="font-mono" fontSize="7" fill="#94a3b8">
                LM393
              </text>
            </g>
          );
        }

        // 5. SOT-23 MOSFETs & BJTs
        if (p.kind === 'sot23') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect x={cx - 10} y={cy - ph / 2 - 5} width="6" height="6" fill="#cbd5e1" />
              <rect x={cx + 4} y={cy - ph / 2 - 5} width="6" height="6" fill="#cbd5e1" />
              <rect x={cx - 3} y={cy + ph / 2 - 1} width="6" height="6" fill="#cbd5e1" />
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx="1.5"
                fill="#0f172a"
                stroke="#64748b"
                strokeWidth="0.9"
              />
              <text x={cx} y={cy + 2.8} textAnchor="middle" className="font-mono" fontSize="7.0" fontWeight="700" fill="#e2e8f0">
                {p.ref}
              </text>
            </g>
          );
        }

        // 6. SMA SS14 Schottky Diodes
        if (p.kind === 'diode_sma') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect x={cx - pw / 2 - 5} y={cy - 6} width={pw + 10} height="12" rx="1.5" fill="#cbd5e1" />
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx="2"
                fill="#111827"
                stroke="#475569"
                strokeWidth="1"
              />
              <rect x={cx - pw / 2 + 3} y={cy - ph / 2 + 1} width="5" height={ph - 2} fill="#e2e8f0" />
              <text x={cx + 4} y={cy + 3} textAnchor="middle" className="font-mono" fontSize="7.4" fontWeight="700" fill="#f1f5f9">
                {p.ref}
              </text>
            </g>
          );
        }

        // 7. 1206 Power Resistors & 1206 22uF MLCCs
        if (p.kind === 'res_1206' || p.kind === 'cap_1206') {
          const isCap = p.kind === 'cap_1206';
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} rx="1.8" fill="#cbd5e1" />
              <rect
                x={cx - pw / 2 + 6}
                y={cy - ph / 2}
                width={pw - 12}
                height={ph}
                fill={isCap ? '#b45309' : '#0f172a'}
              />
              <text x={cx} y={cy + 2.8} textAnchor="middle" className="font-mono" fontSize="6.6" fontWeight="700" fill="#f8fafc">
                {p.label}
              </text>
            </g>
          );
        }

        // 8. Precision 0.1% Thin-Film 0805 Resistors
        if (p.kind === 'res_0805_prec') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} rx="1.2" fill="#e2e8f0" />
              <rect x={cx - pw / 2 + 4.5} y={cy - ph / 2} width={pw - 9} height={ph} fill="#0284c7" />
              <text x={cx} y={cy + 2.5} textAnchor="middle" className="font-mono" fontSize="6.2" fontWeight="700" fill="#ffffff">
                {p.ref}
              </text>
            </g>
          );
        }

        // 9. Unpopulated 2-Pad Copper Tweezer Test Point JP1 (DNP)
        if (p.kind === 'jumper') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect
                x={cx - pw / 2}
                y={cy - ph / 2}
                width={pw}
                height={ph}
                rx="2"
                fill="none"
                stroke={palette.silk}
                strokeWidth="1"
                strokeDasharray="3 2"
                opacity="0.8"
              />
              {/* Exposed ENIG / HASL tweezer pads with open air gap */}
              <rect x={cx - pw / 2 + 4} y={cy - ph / 2 + 3} width={pw / 2 - 7} height={ph - 6} rx="1.5" fill="#eab308" stroke="#a16207" strokeWidth="0.9" />
              <rect x={cx + 3} y={cy - ph / 2 + 3} width={pw / 2 - 7} height={ph - 6} rx="1.5" fill="#eab308" stroke="#a16207" strokeWidth="0.9" />
              <text x={cx} y={cy + ph / 2 + 10} textAnchor="middle" className="font-mono" fontSize="7.2" fontWeight="700" fill={palette.silk}>
                JP1 PADS (OPEN)
              </text>
            </g>
          );
        }

        // 9b. Bare Copper ENIG 1.0 mm Bring-Up Test Pads (TP1-TP5, €0.00)
        if (p.kind === 'test_pad') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <circle cx={cx} cy={cy} r={pw * 0.55} fill="#eab308" stroke="#854d0e" strokeWidth="1.1" />
              <circle cx={cx} cy={cy} r={pw * 0.24} fill="#fef08a" opacity="0.8" />
              <text
                x={cx}
                y={cy - pw * 0.65 - 2}
                textAnchor="middle"
                className="font-mono"
                fontSize="6.4"
                fontWeight="700"
                fill="#fde047"
              >
                {p.ref}
              </text>
            </g>
          );
        }

        // 9c. Optical SMT Fiducials (FID1-FID3: 1.0 mm bare ENIG target inside 2.0 mm mask opening)
        if (p.kind === 'fiducial') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <circle cx={cx} cy={cy} r="10" fill="rgba(15,23,42,0.35)" stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="2 1.5" />
              <circle cx={cx} cy={cy} r="5" fill="#facc15" stroke="#854d0e" strokeWidth="0.9" />
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                className="font-mono"
                fontSize="6.2"
                fontWeight="700"
                fill="#fde047"
              >
                {p.ref}
              </text>
            </g>
          );
        }

        // 9d. Single-Point Star Ground Net-Tie (NT1: GND <-> AGND copper bridge under J1 Pins 9/14)
        if (p.kind === 'net_tie') {
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} rx="1.5" fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth="1" />
              <rect x={cx - pw / 2 + 1.5} y={cy - ph / 2 + 1.5} width={pw * 0.32} height={ph - 3} fill="#eab308" />
              <rect x={cx + pw * 0.18} y={cy - ph / 2 + 1.5} width={pw * 0.32} height={ph - 3} fill="#38bdf8" />
              <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke="#facc15" strokeWidth="3.2" />
              <text
                x={cx}
                y={cy + ph / 2 + 8.2}
                textAnchor="middle"
                className="font-mono"
                fontSize="6.4"
                fontWeight="700"
                fill="#7dd3fc"
              >
                {p.ref}
              </text>
            </g>
          );
        }

        // 10. Diagnostic Status LEDs (Green D2/D3/D12/D33/D34/D35 + Red D36 WD FAULT)
        if (p.kind === 'led_green' || p.kind === 'led_red') {
          const lit = isLedLit(p.ref, boardState);
          const isRed = p.kind === 'led_red';
          return (
            <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
              {selRing}
              {lit && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="22"
                  fill={isRed ? 'url(#ledGlowRed)' : 'url(#ledGlowGreen)'}
                />
              )}
              <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} rx="1.5" fill="#e2e8f0" />
              <rect
                x={cx - pw / 2 + 4}
                y={cy - ph / 2 + 1}
                width={pw - 8}
                height={ph - 2}
                rx="1"
                fill={lit ? (isRed ? '#ef4444' : '#22c55e') : isRed ? '#7f1d1d' : '#14532d'}
              />
              <text
                x={cx}
                y={cy + ph / 2 + 10.5}
                textAnchor="middle"
                className="font-mono"
                fontSize="7.4"
                fontWeight="700"
                fill={isRed ? '#fca5a5' : palette.silk}
              >
                {p.label}
              </text>
            </g>
          );
        }

        // 11. Standard 0805 Resistors, Caps & SOD-123/323 Diodes
        return (
          <g key={p.id} onClick={() => onSelectPart(p)} className="cursor-pointer">
            {selRing}
            <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} rx="1.2" fill="#cbd5e1" />
            <rect
              x={cx - pw / 2 + 4.5}
              y={cy - ph / 2}
              width={pw - 9}
              height={ph}
              fill={p.kind === 'cap_0805' ? '#b45309' : '#0f172a'}
            />
            {p.kind === 'diode_sod123' && (
              <rect x={cx - pw / 2 + 5} y={cy - ph / 2} width="3" height={ph} fill="#f1f5f9" />
            )}
            <text x={cx} y={cy + ph / 2 + 8.2} textAnchor="middle" className="font-mono" fontSize="6.4" fontWeight="700" fill={palette.silk}>
              {p.ref}
            </text>
          </g>
        );
      })}

      {/* ---- MILLIMETER DIMENSION RULERS & EDGE CABLE EXIT ANNOTATIONS ---- */}
      {showRulers && (
        <g className="font-mono" fill={isCad ? '#94a3b8' : '#334155'} stroke={isCad ? '#475569' : '#64748b'}>
          {/* Top Width Dimension */}
          <line x1={ox} y1={24} x2={ox + 65 * S} y2={24} strokeWidth="1.2" />
          <line x1={ox} y1={18} x2={ox} y2={38} strokeWidth="1" />
          <line x1={ox + 65 * S} y1={18} x2={ox + 65 * S} y2={38} strokeWidth="1" />
          <text x={ox + 32.5 * S} y={19} textAnchor="middle" stroke="none" fontSize="10.5" fontWeight="700">
            65.0 mm (Standard Raspberry Pi HAT Width)
          </text>

          {/* Left Sensor Edge Cable-Exit Bracket */}
          <path
            d={`M ${ox - 16} ${oy + 9.0 * S} L ${ox - 24} ${oy + 9.0 * S} L ${ox - 24} ${oy + 45.2 * S} L ${ox - 16} ${oy + 45.2 * S}`}
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.6"
          />
          <text
            x={ox - 34}
            y={oy + 27.1 * S}
            textAnchor="middle"
            stroke="none"
            fill="#0284c7"
            fontSize="10"
            fontWeight="700"
            transform={`rotate(-90 ${ox - 34} ${oy + 27.1 * S})`}
          >
            {spec.leftSensorLabel}
          </text>

          {/* Front Populated Edge Bracket */}
          <path
            d={`M ${ox + (isAllPt ? 8.2 : 9.6) * S} ${oy + 56 * S + 14} L ${ox + (isAllPt ? 8.2 : 9.6) * S} ${oy + 56 * S + 22} L ${ox + (isAllPt ? 38.0 : 20.8) * S} ${oy + 56 * S + 22} L ${ox + (isAllPt ? 38.0 : 20.8) * S} ${oy + 56 * S + 14}`}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1.6"
          />
          <text
            x={ox + (isAllPt ? 23.1 : 15.2) * S}
            y={oy + 56 * S + 37}
            textAnchor="middle"
            stroke="none"
            fill="#7c3aed"
            fontSize="9.8"
            fontWeight="700"
          >
            {spec.frontActuatorLabel}
          </text>

          {/* DNP Front Expansion Bracket */}
          {showDnp && (
            <>
              <path
                d={`M ${ox + (isAllPt ? 39.4 : 23.0) * S} ${oy + 56 * S + 14} L ${ox + (isAllPt ? 39.4 : 23.0) * S} ${oy + 56 * S + 22} L ${ox + (isAllPt ? 55.8 : 54.6) * S} ${oy + 56 * S + 22} L ${ox + (isAllPt ? 55.8 : 54.6) * S} ${oy + 56 * S + 14}`}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.3"
                strokeDasharray="4 2"
              />
              <text
                x={ox + (isAllPt ? 47.6 : 38.8) * S}
                y={oy + 56 * S + 37}
                textAnchor="middle"
                stroke="none"
                fill="#64748b"
                fontSize="9.5"
                fontWeight="600"
              >
                {spec.dnpBracketLabel}
              </text>
            </>
          )}

          {/* Height Dimension */}
          <text
            x={ox + 65 * S + 14}
            y={oy + 28 * S}
            stroke="none"
            fontSize="10"
            fontWeight="700"
            transform={`rotate(90 ${ox + 65 * S + 14} ${oy + 28 * S})`}
            textAnchor="middle"
          >
            56.0 mm HAT Height (49.0 mm Hole Pitch)
          </text>
        </g>
      )}
    </svg>
  );
}
