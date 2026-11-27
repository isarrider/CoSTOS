import { useState } from 'react';
import { Check, Layers, Ruler, ShieldAlert } from 'lucide-react';
import { computeFullHatCosts, type HatEdition } from '../08-FullHat/data/masterBom';

export interface HatSizeWorkspaceProps {
  edition?: HatEdition;
  onEditionChange?: (next: HatEdition) => void;
}

type StackHeightMode = 'normal_11mm' | 'tall_17mm';

interface ComparisonRow {
  metric: string;
  hat65: string;
  hat85: string;
  winner: '65' | '85' | 'tie';
  note: string;
}

function getComparisonRows(edition: HatEdition, stackMode: StackHeightMode): ComparisonRow[] {
  const isAllPt = edition === 'all_pt1000';
  const isNormal11 = stackMode === 'normal_11mm';

  return [
    {
      metric: 'PCB Outline & Copper Area',
      hat65: '65.0 × 56.0 mm (3,640 mm²)',
      hat85: '85.0 × 56.0 mm (4,760 mm² · +30.8%)',
      winner: '85',
      note: '+1,120 mm² (+20.0 mm right overhang above Pi USB/Ethernet)',
    },
    {
      metric: 'JLCPCB 5-Board Fab Cost',
      hat65: '€2.00 (≤100 × 100 mm tier)',
      hat85: '€2.00 (≤100 × 100 mm tier)',
      winner: 'tie',
      note: 'Identical PCB fab price; negligible +€0.20 shipping weight',
    },
    {
      metric: 'J1 Header & H1–H4 Standoffs',
      hat65: 'Normal 11.0 mm + Nylon (€0.45 + €0.32 = €0.77/bd)',
      hat85: 'MUST use Tall 17 mm + Nylon (€1.65 + €0.52 = €2.17/bd)',
      winner: '65',
      note: '65 mm saves €1.40/bd ex-VAT (€1.67 incl. VAT) on passively cooled Pi',
    },
    {
      metric: 'Pi USB-A & RJ45 Clearance (14.5 mm tall)',
      hat65: 'CLEAR — stops at x = 65 mm (3 mm before jacks)',
      hat85: isNormal11
        ? 'COLLISION (−3.5 mm crash into steel USB/RJ45 shells!)'
        : 'CLEARS by +2.5 mm (only with tall 17 mm header)',
      winner: '65',
      note: 'Pi USB-A & Gigabit Ethernet ports sit at x = 68..85 mm, height 13.5–15.5 mm',
    },
    {
      metric: 'Mechanical Support under Screwdriver Torque',
      hat65: 'Rigid 4-corner M2.5 support (H1–H4 cover full PCB)',
      hat85: '20 mm unsupported cantilever past H2/H4 (x = 61.5 mm)',
      winner: '65',
      note: 'Pi has zero mounting holes in the right 20 mm; overhanging screws flex PCB',
    },
    {
      metric: 'Left Edge Sensor Budget (between H1 & H3)',
      hat65: '42.0 mm usable (y = 7.0..49.0 mm)',
      hat85: '42.0 mm usable (IDENTICAL — height stays 56 mm)',
      winner: 'tie',
      note: 'Making the HAT wider (85 mm) adds 0 mm to the Left Edge',
    },
    {
      metric: 'Front Edge Actuator / Terminal Budget',
      hat65: '49.0 mm usable (fits J2 + Opt. J4 [REL1 SMD Pop.] + DNP J3/J5)',
      hat85: '68.0 mm usable (+19.0 mm extra edge length)',
      winner: '85',
      note: isAllPt
        ? '85 mm lets you fit 16P single-row 3.5 mm (56 mm) on the front edge'
        : '1-Wire only uses J2 (11–13 mm); extra 19 mm stays empty unless adding relays',
    },
    {
      metric: isAllPt ? '8× Pt1000 Terminal Architecture' : '1-Wire + Pt1000 Terminal Architecture',
      hat65: isAllPt
        ? '1× Dual-Tier 2×8P DG350D Fixed Screw (29.4 mm, 0 mm overhang)'
        : '1× 8P DG350 Fixed Screw (28.5 mm, 0 mm overhang)',
      hat85: isAllPt
        ? 'Single-row 16P 3.5 mm (56 mm) OR 2×8P + extra relays'
        : 'Same 8P Left Edge (no connector improvement)',
      winner: isAllPt ? '85' : 'tie',
      note: isAllPt
        ? 'DG350D 2×8P already fits 65 mm cleanly with 6.3 mm margin per side & 0 mm overhang'
        : 'DG350 8P leaves 6.75 mm margin per side & 0 mm overhang on 65 × 56 mm',
    },
    {
      metric: 'Analog (U1) vs. 60 kHz Doubler EMI Separation',
      hat65: '22 mm physical gap + split Kelvin AGND',
      hat85: '37 mm gap (+15 mm), BUT right end sits over noisy GbE/USB3',
      winner: 'tie',
      note: '65 mm already isolates U1 cleanly without hovering over Pi Ethernet magnetics',
    },
    {
      metric: 'Passive Heatsink & Standard Pi Case Fit',
      hat65: 'Fits official HAT cases, DIN-rail Pi cases & open USB access',
      hat85: 'Blocks USB/Eth access from above; breaks standard HAT cases',
      winner: '65',
      note: 'Official Raspberry Pi HAT / HAT+ mechanical spec is strictly 65 × 56 mm',
    },
    {
      metric: 'Room for Future Onboard Mains Relays / 24 V Buck',
      hat65: 'Tight (low-voltage J4/J5 pads only, no 230 V creepage)',
      hat85: 'Comfortable (+1,120 mm² for 24 V→5 V buck or SSRs)',
      winner: '85',
      note: 'Only needed if expanding beyond solar sensors + 1× PWM pump',
    },
  ];
}

/**
 * Dual technical CAD comparison SVG:
 * 1. Top-Down Plan View showing 65×56 mm vs 85×56 mm over Pi 5 USB/Ethernet & H1–H4 holes.
 * 2. Side Elevation (X–Z Cross-Section) showing 11 mm normal header vs 17 mm tall header clearance/crash.
 */
function HatSizeBlueprintSvg({
  edition,
  stackMode,
}: {
  edition: HatEdition;
  stackMode: StackHeightMode;
}) {
  const usesDualTier = edition === 'all_pt1000';
  const isNormal11 = stackMode === 'normal_11mm';
  const hatZ = isNormal11 ? 11.0 : 17.0;
  const usbTopZ = 16.1; // 1.6 mm Pi PCB + 14.5 mm stacked USB-A/Ethernet can
  const hasCrash = hatZ < usbTopZ;

  // Top-down scale: 1 mm = 3.2 px -> 85 mm = 272 px, 56 mm = 179.2 px
  const s = 3.2;
  const tx = 44;
  const ty = 26;

  // Side elevation scale: X: 1 mm = 3.2 px (same alignment!), Z: 1 mm = 5.5 px
  const sz = 5.5;
  const baseLineY = 178; // z = 0 mm (bottom of Pi PCB)
  const zY = (zMm: number) => baseLineY - zMm * sz;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT SVG: TOP-DOWN PLAN VIEW */}
      <div className="border border-slate-200 rounded-md bg-slate-50 p-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            Top-Down Footprint Overlay (65 × 56 mm vs. 85 × 56 mm)
          </span>
          <span className="font-mono text-[11px] text-slate-500">Scale 1:1 ratio</span>
        </div>

        <svg viewBox="0 0 360 232" className="w-full h-auto block select-none">
          {/* Raspberry Pi Base Board (85 × 56 mm) */}
          <rect
            x={tx}
            y={ty}
            width={85 * s}
            height={56 * s}
            rx={3 * s}
            fill="#e2e8f0"
            stroke="#64748b"
            strokeWidth="1.2"
          />

          {/* Pi USB-A & Ethernet Steel Cans (x = 68..85 mm) */}
          <rect x={tx + 68 * s} y={ty + 4 * s} width={17 * s} height={15 * s} rx="2" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
          <text x={tx + 76.5 * s} y={ty + 12.5 * s} fontSize="8" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            RJ45
          </text>
          <rect x={tx + 69 * s} y={ty + 21.5 * s} width={16 * s} height={13.5 * s} rx="2" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
          <text x={tx + 77 * s} y={ty + 29 * s} fontSize="8" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            USB3
          </text>
          <rect x={tx + 69 * s} y={ty + 37.5 * s} width={16 * s} height={13.5 * s} rx="2" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
          <text x={tx + 77 * s} y={ty + 45 * s} fontSize="8" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            USB2
          </text>

          {/* Standard 65 × 56 mm CoSTOS HAT Zone */}
          <rect
            x={tx}
            y={ty}
            width={65 * s}
            height={56 * s}
            rx={3 * s}
            fill="#15803d"
            fillOpacity="0.88"
            stroke="#052e16"
            strokeWidth="1.5"
          />

          {/* +20 mm Full-Pi Overhang Zone (x = 65..85 mm) */}
          <rect
            x={tx + 65 * s}
            y={ty}
            width={20 * s}
            height={56 * s}
            rx="2"
            fill={hasCrash ? '#dc2626' : '#f59e0b'}
            fillOpacity="0.22"
            stroke={hasCrash ? '#dc2626' : '#d97706'}
            strokeWidth="1.6"
            strokeDasharray="5 3"
          />
          <text
            x={tx + 75 * s}
            y={ty + 54 * s}
            fontSize="7.5"
            fontFamily="monospace"
            fontWeight="bold"
            fill={hasCrash ? '#991b1b' : '#92400e'}
            textAnchor="middle"
          >
            +20 mm (NO HOLES)
          </text>

          {/* J1 40-Pin Header */}
          <rect
            x={tx + 7.5 * s}
            y={ty + 1.2 * s}
            width={50 * s}
            height={5.0 * s}
            rx="1.5"
            fill="#0f172a"
            stroke="#94a3b8"
            strokeWidth="0.8"
          />
          <text x={tx + 32.5 * s} y={ty + 4.6 * s} fontSize="7.5" fontFamily="monospace" fill="#e2e8f0" textAnchor="middle">
            J1 40-PIN ({isNormal11 ? '11 mm Normal' : '17 mm Tall'})
          </text>

          {/* Left-Edge Fixed Rising-Cage Screw Terminal (DG350 8P / DG350D 2×8P — 0 mm Overhang!) */}
          <rect
            x={tx}
            y={ty + (usesDualTier ? 13.3 : 13.75) * s}
            width={(usesDualTier ? 10.0 : 8.2) * s}
            height={(usesDualTier ? 29.4 : 28.5) * s}
            rx="2"
            fill="#16a34a"
            stroke="#ffffff"
            strokeWidth="1.1"
          />
          <text
            x={tx + (usesDualTier ? 5.0 : 4.1) * s}
            y={ty + 28 * s}
            fontSize="7.2"
            fontFamily="monospace"
            fontWeight="bold"
            fill="#ffffff"
            textAnchor="middle"
            transform={`rotate(-90 ${tx + (usesDualTier ? 5.0 : 4.1) * s} ${ty + 28 * s})`}
          >
            {usesDualTier ? 'J6 DG350D 2×8P (29.4mm)' : 'J6 DG350 8P (28.5mm)'}
          </text>

          {/* Front Edge J2 PUMP1 (DG350-3.5-03P — 0 mm Overhang!) */}
          <rect
            x={tx + 15.2 * s - 5.5 * s}
            y={ty + 47.8 * s}
            width={11.0 * s}
            height={8.2 * s}
            rx="1.5"
            fill="#16a34a"
            stroke="#ffffff"
            strokeWidth="0.9"
          />
          <text x={tx + 15.2 * s} y={ty + 52.8 * s} fontSize="7.0" fontFamily="monospace" fill="#ffffff" textAnchor="middle" fontWeight="bold">
            J2 3P
          </text>

          {/* 4 Mounting Holes (H1–H4 stop at x = 61.5 mm!) */}
          {[
            { ref: 'H1', x: 3.5, y: 3.5 },
            { ref: 'H2', x: 61.5, y: 3.5 },
            { ref: 'H3', x: 3.5, y: 52.5 },
            { ref: 'H4', x: 61.5, y: 52.5 },
          ].map((h) => (
            <g key={h.ref}>
              <circle
                cx={tx + h.x * s}
                cy={ty + h.y * s}
                r={1.6 * s}
                fill="#fef08a"
                stroke="#854d0e"
                strokeWidth="1.2"
              />
              <text
                x={tx + h.x * s + (h.x < 10 ? 7 : -14)}
                y={ty + h.y * s + (h.y < 10 ? 11 : -5)}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="bold"
                fill="#fef9c3"
              >
                {h.ref}
              </text>
            </g>
          ))}

          {/* Center label inside 65 mm HAT */}
          <text x={tx + 35 * s} y={ty + 25 * s} fontSize="10" fontFamily="monospace" fontWeight="bold" fill="#ffffff" textAnchor="middle">
            STANDARD HAT
          </text>
          <text x={tx + 35 * s} y={ty + 30.5 * s} fontSize="8.5" fontFamily="monospace" fill="#dcfce7" textAnchor="middle">
            65.0 × 56.0 mm (3,640 mm²)
          </text>
          <text x={tx + 35 * s} y={ty + 35.5 * s} fontSize="7.5" fontFamily="monospace" fill="#bbf7d0" textAnchor="middle">
            4-Corner M2.5 Bolted · Zero Overhang
          </text>

          {/* Dimension ruler along bottom */}
          <g stroke="#334155" strokeWidth="1">
            <line x1={tx} y1={ty + 56 * s + 10} x2={tx + 65 * s} y2={ty + 56 * s + 10} />
            <line x1={tx} y1={ty + 56 * s + 6} x2={tx} y2={ty + 56 * s + 14} />
            <line x1={tx + 65 * s} y1={ty + 56 * s + 6} x2={tx + 65 * s} y2={ty + 56 * s + 14} />
            <line x1={tx + 65 * s} y1={ty + 56 * s + 10} x2={tx + 85 * s} y2={ty + 56 * s + 10} stroke={hasCrash ? '#dc2626' : '#d97706'} />
            <line x1={tx + 85 * s} y1={ty + 56 * s + 6} x2={tx + 85 * s} y2={ty + 56 * s + 14} stroke={hasCrash ? '#dc2626' : '#d97706'} />
          </g>
          <text x={tx + 32.5 * s} y={ty + 56 * s + 22} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">
            65.0 mm (Standard HAT)
          </text>
          <text
            x={tx + 75 * s}
            y={ty + 56 * s + 22}
            fontSize="8.5"
            fontFamily="monospace"
            fontWeight="bold"
            fill={hasCrash ? '#b91c1c' : '#b45309'}
            textAnchor="middle"
          >
            +20 mm
          </text>
        </svg>
      </div>

      {/* RIGHT SVG: SIDE ELEVATION (X-Z CROSS-SECTION) */}
      <div className="border border-slate-200 rounded-md bg-slate-50 p-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            Side Profile (X–Z Cross-Section) — {isNormal11 ? 'Normal 11 mm J1' : 'Tall 17 mm J1'}
          </span>
          <span
            className={`font-mono text-[11px] font-bold ${
              hasCrash ? 'text-rose-700' : 'text-amber-700'
            }`}
          >
            {hasCrash ? '85 mm CRASHES USB/RJ45!' : '85 mm clears (+€1.40/bd)'}
          </span>
        </div>

        <svg viewBox="0 0 360 232" className="w-full h-auto block select-none">
          {/* Background altitude guide lines */}
          <g stroke="#e2e8f0" strokeWidth="0.7">
            {[0, 11, 16.1, 25].map((z) => (
              <line key={z} x1="20" y1={zY(z)} x2="345" y2={zY(z)} />
            ))}
          </g>

          {/* Raspberry Pi PCB (85 × 1.6 mm) */}
          <rect
            x={tx}
            y={zY(1.6)}
            width={85 * s}
            height={1.6 * sz}
            fill="#166534"
            stroke="#0f172a"
            strokeWidth="1"
          />
          <text x={tx + 32 * s} y={zY(1.6) + 21} fontSize="8.5" fontFamily="monospace" fill="#334155" textAnchor="middle">
            Raspberry Pi 3/4/5 PCB (85 mm · Passively Cooled)
          </text>

          {/* Passive Heatsink on Pi SoC (h = 6.0 mm, z = 1.6..7.6 mm) */}
          <rect
            x={tx + 18 * s}
            y={zY(7.6)}
            width={28 * s}
            height={6.0 * sz}
            fill="#94a3b8"
            stroke="#334155"
            strokeWidth="1"
          />
          {[22, 26, 30, 34, 38, 42].map((fx) => (
            <line key={fx} x1={tx + fx * s} y1={zY(7.6)} x2={tx + fx * s} y2={zY(4.2)} stroke="#475569" strokeWidth="1" />
          ))}
          <text x={tx + 32 * s} y={zY(4.2) + 8} fontSize="7" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            Passive Heatsink (6 mm)
          </text>

          {/* Pi USB-A & Gigabit Ethernet Steel Shells (x = 68..85 mm, z = 1.6..16.1 mm = 14.5 mm tall!) */}
          <rect
            x={tx + 68 * s}
            y={zY(usbTopZ)}
            width={17 * s}
            height={14.5 * sz}
            fill="#cbd5e1"
            stroke="#334155"
            strokeWidth="1.2"
          />
          <text x={tx + 76.5 * s} y={zY(10.5)} fontSize="8" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            USB / RJ45
          </text>
          <text x={tx + 76.5 * s} y={zY(7.8)} fontSize="7.5" fontFamily="monospace" fill="#334155" textAnchor="middle">
            14.5 mm tall
          </text>

          {/* Non-Conductive White Nylon M2.5 Standoffs at H1/H3 (x = 3.5) and H2/H4 (x = 61.5) */}
          {[3.5, 61.5].map((hx) => (
            <rect
              key={hx}
              x={tx + hx * s - 3}
              y={zY(hatZ)}
              width={6}
              height={(hatZ - 1.6) * sz}
              fill="#f8fafc"
              stroke="#475569"
              strokeWidth="0.9"
            />
          ))}

          {/* J1 40-Pin Header visual pillar */}
          <rect
            x={tx + 12 * s}
            y={zY(hatZ)}
            width={42 * s}
            height={(hatZ - 1.6) * sz}
            fill="#1e293b"
            fillOpacity="0.22"
            stroke="#1e293b"
            strokeWidth="0.8"
            strokeDasharray="3 2"
          />
          <text x={tx + 33 * s} y={zY((hatZ + 7.6) / 2) + 3} fontSize="7.5" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            J1 = {hatZ.toFixed(1)} mm ({isNormal11 ? '+3.4 mm air gap' : '+9.4 mm tall gap'})
          </text>

          {/* Standard 65 × 56 mm HAT PCB (z = hatZ .. hatZ + 1.6 mm) */}
          <rect
            x={tx}
            y={zY(hatZ + 1.6)}
            width={65 * s}
            height={1.6 * sz}
            fill="#15803d"
            stroke="#052e16"
            strokeWidth="1.2"
          />
          {/* Left-Edge Fixed Screw Terminal (DG350 / DG350D — flush at x = 0, 0 mm Overhang!) */}
          {usesDualTier ? (
            <g>
              <rect
                x={tx}
                y={zY(hatZ + 1.6 + 10.2)}
                width={10.0 * s}
                height={10.2 * sz}
                rx="1.5"
                fill="#16a34a"
                stroke="#052e16"
                strokeWidth="1"
              />
              <rect
                x={tx + 4.4 * s}
                y={zY(hatZ + 1.6 + 18.5)}
                width={5.6 * s}
                height={8.3 * sz}
                rx="1.5"
                fill="#22c55e"
                stroke="#052e16"
                strokeWidth="1"
              />
              <text x={tx + 5.0 * s} y={zY(hatZ + 6.5)} fontSize="6.5" fontFamily="monospace" fill="#ffffff" textAnchor="middle" fontWeight="bold">
                J6 2×8P
              </text>
            </g>
          ) : (
            <g>
              <rect
                x={tx}
                y={zY(hatZ + 1.6 + 10.5)}
                width={8.2 * s}
                height={10.5 * sz}
                rx="1.5"
                fill="#16a34a"
                stroke="#052e16"
                strokeWidth="1"
              />
              <text x={tx + 4.1 * s} y={zY(hatZ + 6.5)} fontSize="6.8" fontFamily="monospace" fill="#ffffff" textAnchor="middle" fontWeight="bold">
                J6 8P
              </text>
            </g>
          )}

          <text x={tx + 36 * s} y={zY(hatZ + 4.5)} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#15803d" textAnchor="middle">
            65 mm HAT — CLEAR OF USB/RJ45
          </text>

          {/* Hypothetical +20 mm Overhang (x = 65..85 mm) */}
          <rect
            x={tx + 65 * s}
            y={zY(hatZ + 1.6)}
            width={20 * s}
            height={1.6 * sz}
            fill={hasCrash ? '#dc2626' : '#f59e0b'}
            fillOpacity="0.8"
            stroke={hasCrash ? '#7f1d1d' : '#92400e'}
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />

          {/* Crash or Cantilever Callout */}
          {hasCrash ? (
            <g>
              <rect
                x={tx + 65 * s}
                y={zY(usbTopZ)}
                width={20 * s}
                height={(usbTopZ - hatZ) * sz}
                fill="#dc2626"
                fillOpacity="0.35"
                stroke="#dc2626"
                strokeWidth="1.4"
              />
              <text x={tx + 75 * s} y={zY(usbTopZ + 3.8)} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#b91c1c" textAnchor="middle">
                CRASH (−3.5 mm!)
              </text>
              <text x={tx + 75 * s} y={zY(usbTopZ + 1.5)} fontSize="7" fontFamily="monospace" fill="#991b1b" textAnchor="middle">
                Shorts on USB shield
              </text>
            </g>
          ) : (
            <g>
              <text x={tx + 75 * s} y={zY(hatZ + 5.0)} fontSize="7.8" fontFamily="monospace" fontWeight="bold" fill="#b45309" textAnchor="middle">
                20 mm Cantilever
              </text>
              <text x={tx + 75 * s} y={zY(hatZ + 2.6)} fontSize="7" fontFamily="monospace" fill="#92400e" textAnchor="middle">
                No standoff support
              </text>
            </g>
          )}

          {/* Left Z-axis height labels */}
          <text x="16" y={zY(0) + 3} fontSize="7.5" fontFamily="monospace" fill="#64748b">
            0 mm
          </text>
          <text x="10" y={zY(hatZ) + 3} fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
            {hatZ.toFixed(0)} mm
          </text>
          <text x="10" y={zY(usbTopZ) + 3} fontSize="7.5" fontFamily="monospace" fill="#475569">
            16 mm
          </text>
        </svg>
      </div>
    </div>
  );
}

export function HatSizeWorkspace({
  edition: controlledEdition,
  onEditionChange,
}: HatSizeWorkspaceProps = {}) {
  const [localEdition, setLocalEdition] = useState<HatEdition>('all_pt1000');
  const edition = controlledEdition ?? localEdition;
  const setEdition = (next: HatEdition) => {
    setLocalEdition(next);
    onEditionChange?.(next);
  };
  const [stackMode, setStackMode] = useState<StackHeightMode>('normal_11mm');

  const rows = getComparisonRows(edition, stackMode);
  const wins65 = rows.filter((r) => r.winner === '65').length;
  const wins85 = rows.filter((r) => r.winner === '85').length;

  const costOpts = {
    batchSize: 5 as const,
    includeShipping: true,
    includeVat19: true,
    includeThtHardware: true,
    includeJlcpcbThtSoldering: true,
    conservative01PctFee: false,
  };
  const landedOneWire = computeFullHatCosts(costOpts, 'onewire').revBGemini.perBoardEur;
  const landedAllPt = computeFullHatCosts(costOpts, 'all_pt1000').revBGemini.perBoardEur;

  return (
    <div className="space-y-5">
      {/* Executive Dark Header Strip (Tab 05 Design System) */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 09 · MECHANICAL FORM-FACTOR TRADE-OFF</span>
            <span>·</span>
            <span className="tabular-nums">65 × 56 mm (3,640 mm²) vs. 85 × 56 mm (4,760 mm²) · NORMAL 11.0 mm J1</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            HAT Size Comparison — Standard HAT (65 × 56 mm) vs. Full Pi Size (85 × 56 mm)
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Evaluates what you actually gain and lose by expanding the CoSTOS HAT to match the full{' '}
            <strong className="text-white">85 × 56 mm</strong> Raspberry Pi outline — specifically factoring in your{' '}
            <strong className="text-white">passively cooled Pi with a normal 11.0 mm J1 header</strong>.
          </p>
        </div>

        <div className="text-right font-mono tabular-nums shrink-0">
          <div className="text-[11px] text-emerald-400 font-semibold">LOCKED FORM FACTOR</div>
          <div className="text-base font-bold text-white">65 × 56 mm HAT</div>
          <div className="text-[11px] text-slate-400">Saves €1.40/bd vs 17 mm J1</div>
        </div>
      </div>

      {/* Sub-Navigation Bar: Edition + J1 Stack Height */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEdition('onewire')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              edition === 'onewire'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            1-Wire Edition (11 pins)
          </button>
          <button
            type="button"
            onClick={() => setEdition('all_pt1000')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              edition === 'all_pt1000'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All-Pt1000 8× (19 pins)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-slate-500 mr-1">J1 Stack:</span>
          <button
            type="button"
            onClick={() => setStackMode('normal_11mm')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              stackMode === 'normal_11mm'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Normal 11.0 mm (Default)
          </button>
          <button
            type="button"
            onClick={() => setStackMode('tall_17mm')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              stackMode === 'tall_17mm'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tall 17.0 mm (+€1.40/bd)
          </button>
        </div>
      </div>

      {/* Clear Engineering Recommendation Panel */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold">
            Engineering Recommendation — Keep Standard 65 × 56 mm HAT + Normal 11.0 mm J1 Header
          </div>
          <div className="text-[11px] font-mono text-slate-300 tabular-nums">
            Scorecard: 65 × 56 mm wins {wins65} criteria · 85 × 56 mm wins {wins85} criteria
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="lg:col-span-7 p-4 space-y-2 bg-emerald-50/30">
            <div className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wide">
              Recommended Winner · 65 × 56 mm Standard HAT + 11.0 mm Normal J1
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Your normal 11 mm J1 header makes 65 × 56 mm the clear mechanical and cost winner
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed">
              The Raspberry Pi&apos;s metal <strong>USB-A and Gigabit Ethernet jacks are 13.5–15.5 mm tall</strong>.
              Because a standard <strong>65 × 56 mm HAT stops at x = 65 mm</strong> (3 mm before the jacks), you can use
              a <strong>normal 11.0 mm J1 header (€0.45)</strong> and <strong>11 mm nylon standoffs (€0.32)</strong> —
              saving <strong>€1.40/bd ex-VAT (€1.67/bd incl. VAT)</strong> with zero collision, full 4-corner screw
              rigidity under screwdriver torque, and standard Raspberry Pi case compatibility.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs font-mono tabular-nums text-slate-800">
              <span>
                5-bd Landed 1-Wire: <strong className="text-emerald-800">€{landedOneWire.toFixed(2)}/bd</strong>
              </span>
              <span>
                5-bd Landed All-Pt1000 8×: <strong className="text-blue-800">€{landedAllPt.toFixed(2)}/bd</strong>
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 p-4 space-y-2 bg-slate-50/60">
            <div className="text-[11px] font-mono font-bold text-amber-800 uppercase tracking-wide">
              When 85 × 56 mm (Full Pi Size) Would Make Sense
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Expanding to <strong>85 × 56 mm</strong> forces you back to an expensive{' '}
              <strong>17–20 mm tall stacking header (+€1.40/bd)</strong> just to clear the Pi&apos;s USB/Ethernet cans,
              and leaves an unsupported 20 mm cantilever. Only choose 85 × 56 mm if you plan to add:
            </p>
            <ul className="space-y-1 text-xs text-slate-700 list-disc pl-4">
              <li>An onboard <strong>24 V → 5 V industrial buck</strong> or <strong>mains/SSR relays</strong></li>
              <li>A <strong>single-row 16-pin 3.5 mm (56 mm)</strong> terminal strip along the front edge instead of a compact 2×8P dual-tier block</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Dual CAD Blueprints (Top-Down + Side Elevation) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Ruler className="w-4 h-4 text-slate-500" />
            1. Mechanical Blueprint &amp; Side Elevation — Why 11 mm J1 Requires 65 × 56 mm
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Toggle &ldquo;J1 Stack Height&rdquo; above to see 11 mm crash vs. 17 mm clearance
          </div>
        </div>
        <HatSizeBlueprintSvg edition={edition} stackMode={stackMode} />
      </div>

      {/* Benefits vs Drawbacks Side-by-Side Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Standard 65 × 56 mm */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Standard HAT — 65.0 × 56.0 mm (Recommended)
            </h2>
            <span className="text-[11px] font-mono tabular-nums font-semibold text-emerald-700">
              3,640 mm² · 11 mm J1 OK
            </span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Clear Benefits
              </div>
              <ul className="space-y-1 text-slate-700 list-disc pl-4">
                <li>
                  <strong>Works with normal 11.0 mm J1 header (€0.45):</strong> stops 3 mm before the 14.5 mm USB-A /
                  Ethernet cans — saves <strong>€1.40/bd ex-VAT</strong> vs. tall stacking headers.
                </li>
                <li>
                  <strong>Zero PCB flex when tightening screws:</strong> all 4 corners are bolted on M2.5 standoffs
                  (H1–H4 cover the full board).
                </li>
                <li>
                  <strong>Fits standard Pi cases &amp; open passive cooling:</strong> leaves USB, Ethernet, and passive
                  airflow completely unobstructed.
                </li>
                <li>
                  <strong>Already fits all 8× Pt1000 cleanly with 0 mm overhang:</strong> DG350D 2×8P fixed screw
                  (29.4 mm) leaves 6.3 mm clearance on each side of H1/H3 and keeps J2 + Opt. J4 (REL1 SMD pop.) + DNP J3/J5 clear.
                </li>
              </ul>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="font-semibold text-rose-800 mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Drawbacks
              </div>
              <ul className="space-y-1 text-slate-700 list-disc pl-4">
                <li>
                  8× Pt1000 requires a 2-tier <code>2×8P</code> terminal block (a 16-pin single-row 3.5 mm strip is
                  56 mm and will not fit).
                </li>
                <li>
                  No spare area for future onboard 230 V relays or an isolated 24 V → 5 V DC/DC converter.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Full Pi Size 85 × 56 mm */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Full Pi Footprint — 85.0 × 56.0 mm (+20 mm Overhang)
            </h2>
            <span className="text-[11px] font-mono tabular-nums font-semibold text-amber-700">
              4,760 mm² · Needs 17 mm J1
            </span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Clear Benefits
              </div>
              <ul className="space-y-1 text-slate-700 list-disc pl-4">
                <li>
                  <strong>+30.8% PCB area (+1,120 mm²) at €0 extra JLCPCB fab cost</strong> (both stay in the ≤100 × 100
                  mm €2.00 tier).
                </li>
                <li>
                  <strong>+19 mm longer Front Edge (68 mm usable):</strong> fits a single-row 16-pin 3.5 mm (56 mm)
                  screw strip for 8× Pt1000, or populated J3 PUMP2 + J4/J5 relay headers + 24 V buck.
                </li>
                <li>
                  <strong>Wider internal layout spacing:</strong> +15 mm extra room between U1 Pt1000 analog zone and
                  the 60 kHz pump doubler.
                </li>
              </ul>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="font-semibold text-rose-800 mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Drawbacks
              </div>
              <ul className="space-y-1 text-slate-700 list-disc pl-4">
                <li>
                  <strong>Physically crashes into Pi USB-A &amp; Ethernet at 11 mm height:</strong> forces an expensive
                  17–20 mm tall stacking header + tall standoffs (+€1.40/bd) even on a passively cooled Pi.
                </li>
                <li>
                  <strong>20 mm unsupported cantilever:</strong> no mounting holes exist past x = 61.5 mm, so tightening
                  terminal screws on the right overhang flexes the PCB.
                </li>
                <li>
                  <strong>Adds 0 mm to the Left Edge:</strong> Left Edge stays 56 mm tall (42.0 mm between H1 &amp; H3).
                </li>
                <li>
                  Breaks official Raspberry Pi HAT case fit and puts circuits directly above noisy GbE/USB3 shields.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed 11-Row Technical Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            2. Point-by-Point Engineering Comparison Table
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Active view: {edition === 'all_pt1000' ? 'All-Pt1000 8×' : '1-Wire'} ·{' '}
            {stackMode === 'normal_11mm' ? '11.0 mm Normal J1' : '17.0 mm Tall J1'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-3">Engineering Criterion</th>
                <th className="py-2.5 px-3 bg-emerald-50/40 text-emerald-950 border-l border-slate-200">
                  Standard HAT (65 × 56 mm)
                </th>
                <th className="py-2.5 px-3 bg-amber-50/40 text-amber-950 border-l border-slate-200">
                  Full Pi Size (85 × 56 mm)
                </th>
                <th className="py-2.5 px-3 border-l border-slate-200 whitespace-nowrap">Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.metric} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 align-top">
                    <div className="font-semibold text-slate-900">{r.metric}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{r.note}</div>
                  </td>
                  <td className="py-2.5 px-3 align-top border-l border-slate-200 bg-emerald-50/15 font-mono text-[11px] text-slate-800">
                    {r.hat65}
                  </td>
                  <td className="py-2.5 px-3 align-top border-l border-slate-200 bg-amber-50/15 font-mono text-[11px] text-slate-800">
                    {r.hat85}
                  </td>
                  <td className="py-2.5 px-3 align-top border-l border-slate-200 font-mono text-[11px] font-bold whitespace-nowrap">
                    {r.winner === '65' && <span className="text-emerald-700">65 × 56 mm</span>}
                    {r.winner === '85' && <span className="text-amber-700">85 × 56 mm</span>}
                    {r.winner === 'tie' && <span className="text-slate-500">Tie / Same</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
