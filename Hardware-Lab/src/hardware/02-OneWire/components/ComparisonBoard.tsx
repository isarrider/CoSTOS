import {
  ONEWIRE_TOPOLOGY_ORDER,
  ONEWIRE_TOPOLOGY_SPECS,
  OneWireSimParams,
  OneWireTopologyId,
  evaluateOneWireBus,
  oneWirePerBoardCostEur,
} from '../physics/model';
import { OneWireCircuitSvg } from './CircuitDiagramSvg';
import { OneWireConclusionScorecard } from './ConclusionScorecard';
import { OneWireKicadBomPinout } from './KicadBomPinout';
import { OneWireAuditHistory } from './AuditHistory';

interface Props {
  params: OneWireSimParams;
  batchSize: 2 | 5;
  onChangeBatchSize: (size: 2 | 5) => void;
  onInspectInSimulator: (id: OneWireTopologyId) => void;
}

export function OneWireComparisonBoard({
  params,
  batchSize,
  onChangeBatchSize,
  onInspectInSimulator,
}: Props) {
  const revARes = evaluateOneWireBus('rev_a_baseline', params);
  const revBRes = evaluateOneWireBus('gemini_rev_b_2n7002', params);
  const revACost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.rev_a_baseline, batchSize);
  const revBCost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.gemini_rev_b_2n7002, batchSize);

  const rows = ONEWIRE_TOPOLOGY_ORDER.map((id) => {
    const spec = ONEWIRE_TOPOLOGY_SPECS[id];
    const norm30 = evaluateOneWireBus(id, { ...params, cableLengthM: 30, activeFault: 'none' });
    const shortA = evaluateOneWireBus(id, { ...params, activeFault: 'vdd_short_a' });
    const dq12v = evaluateOneWireBus(id, { ...params, activeFault: 'dq_to_12v' });
    const vdd12v = evaluateOneWireBus(id, { ...params, activeFault: 'vdd_to_12v' });
    const unitCost = oneWirePerBoardCostEur(spec, batchSize);
    return { spec, norm30, shortA, dq12v, vdd12v, unitCost };
  });

  return (
    <div className="space-y-6">
      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            Cable Reach (LiYCY 75 pF/m)
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-emerald-700">{revBRes.maxReachM.toFixed(0)} m</span>
            <span className="text-xs text-slate-500">vs {revARes.maxReachM.toFixed(0)} m Rev A</span>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            Native 5 V bus + 2.2 kΩ pull-up gives 2.5× noise margin (2.8 V vs 1.1 V) in 230 V boiler rooms.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            Bus A/B Fault Isolation
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-cyan-700">47 mA</span>
            <span className="text-xs text-slate-500">0.22 W dead-short cap</span>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            Per-bus SS14 + 100 Ω 0.5 W eliminates shared F2 PTC brownout surge; Bus B stays 100% alive.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            Pi GPIO Under +12 V Fault
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-emerald-700">3.30 V</span>
            <span className="text-xs text-slate-500">0.0 mA injected</span>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            60 V 2N7002 blocks +12 V/+V_DRV on DQ while SS14 blocks +40 V reverse feed on VDD.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            Cost ({batchSize}× Batch, Both Buses)
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900">€{revBCost.toFixed(2)}</span>
            <span className="text-xs text-emerald-700 font-semibold">
              Saves €{(revACost - revBCost).toFixed(2)}/bd
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            100% JLCPCB Basic (€0.00 fee); 7 of 8 part reels already on Pt1000 / Pump / Watchdog.
          </p>
        </div>
      </div>

      {/* Quick-Jump Bar */}
      <nav
        aria-label="1-Wire Report Sections"
        className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-xs"
      >
        <span className="font-mono uppercase tracking-wider text-[10.5px] font-semibold text-slate-400 mr-1">
          Jump to:
        </span>
        {[
          { href: '#onewire-comparison-table', label: '1. Comparison Table' },
          { href: '#onewire-pros-cons', label: '2. All 5 Architectures & BOMs' },
          { href: '#onewire-conclusion', label: '3. 3-Way Scorecard' },
          { href: '#onewire-kicad-bom', label: '4. KiCad BOM & Pinout' },
          { href: '#onewire-audit-history', label: '5. Audit History (Rev A → B)' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-900 text-slate-700 font-medium transition-colors whitespace-nowrap"
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Master Comparison Table */}
      <section
        id="onewire-comparison-table"
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1-Wire Bus Interface &amp; Protection Comparison Table (All 5 Architectures)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated at 30 m shielded LiYCY boiler cable (5× DS18B20), VDD dead short, +12 V DQ miswire, and +12 V VDD reverse-feed
            </p>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeBatchSize(2)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                batchSize === 2 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2-Board Batch
            </button>
            <button
              type="button"
              onClick={() => onChangeBatchSize(5)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                batchSize === 5 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5-Board Batch
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-4">Architecture</th>
                <th className="py-2.5 px-3">Bus V</th>
                <th className="py-2.5 px-3">Max Reach</th>
                <th className="py-2.5 px-3">V_Pi @ 30 m</th>
                <th className="py-2.5 px-3">VDD Short A</th>
                <th className="py-2.5 px-3">+12 V on DQ</th>
                <th className="py-2.5 px-3">+12 V on VDD</th>
                <th className="py-2.5 px-3">Cost ({batchSize}×)</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {rows.map(({ spec, norm30, shortA, dq12v, vdd12v, unitCost }) => {
                const isRec = spec.id === 'gemini_rev_b_2n7002';
                return (
                  <tr
                    key={spec.id}
                    className={isRec ? 'bg-emerald-50/50 hover:bg-emerald-50/80' : 'hover:bg-slate-50/80'}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{spec.shortName}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {spec.partCountBothBuses} parts · €{spec.jlcpcbFeederFeeEur.toFixed(2)} fee
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800 tabular-nums">
                      {spec.busVoltageV.toFixed(1)} V
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                      {norm30.maxReachM.toFixed(0)} m
                    </td>
                    <td
                      className={`py-3 px-3 font-mono font-semibold tabular-nums ${
                        norm30.piVihMarginV >= 0.3
                          ? 'text-emerald-700'
                          : norm30.piVihMarginV >= 0
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {norm30.vPiAtSampleV.toFixed(2)} V
                    </td>
                    <td
                      className={`py-3 px-3 font-mono text-[11px] font-semibold ${
                        shortA.faultVerdict === 'PASS'
                          ? 'text-emerald-700'
                          : shortA.faultVerdict === 'MARGINAL'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {shortA.faultVerdict} ({shortA.faultSupplyDrawMa} mA)
                    </td>
                    <td
                      className={`py-3 px-3 font-mono text-[11px] font-semibold ${
                        dq12v.faultVerdict === 'PASS' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {dq12v.faultVerdict} ({dq12v.piGpioPeakV.toFixed(1)} V)
                    </td>
                    <td
                      className={`py-3 px-3 font-mono text-[11px] font-semibold ${
                        vdd12v.faultVerdict === 'PASS' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {vdd12v.faultVerdict}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                      €{unitCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectInSimulator(spec.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Simulate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Option Breakdowns */}
      <section id="onewire-pros-cons" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Detailed Architecture Evaluations, Schematics &amp; BOMs (Options 01 – 05)
          </h2>
          <span className="text-xs font-mono text-slate-500">All 5 options · Dual-bus BOM</span>
        </div>

        {rows.map(({ spec, norm30, unitCost }, idx) => {
          const isRec = spec.id === 'gemini_rev_b_2n7002';
          return (
            <article
              key={spec.id}
              className={`bg-white border rounded-lg overflow-hidden ${
                isRec ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              <div
                className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${
                  isRec ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-[11px] font-mono font-semibold text-slate-500">
                    Option 0{idx + 1} · {spec.piInterface}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mt-0.5">{spec.name}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono text-xs tabular-nums">
                    <div className="font-semibold text-slate-900">€{unitCost.toFixed(2)} / board</div>
                    <div className="text-[11px] text-slate-500">
                      Reach {norm30.maxReachM.toFixed(0)} m · Fee €{spec.jlcpcbFeederFeeEur.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectInSimulator(spec.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Open in Simulator
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-xs text-slate-700 leading-relaxed">{spec.verdict}</p>

                <OneWireCircuitSvg topologyId={spec.id} result={norm30} compact />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-md p-4">
                    <div className="text-xs font-semibold text-emerald-900 mb-2">Strengths &amp; Advantages</div>
                    <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                      {spec.pros.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-rose-50/40 border border-rose-200/80 rounded-md p-4">
                    <div className="text-xs font-semibold text-rose-900 mb-2">Limitations &amp; Risks</div>
                    <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                      {spec.cons.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                    <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                      Fail-Safe &amp; Protection Profile
                    </div>
                    <p className="text-slate-700 mt-1 leading-relaxed">{spec.failSafeProfile}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                    <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                      Linux Kernel &amp; Pi 5 Software Note
                    </div>
                    <p className="text-slate-700 mt-1 leading-relaxed">{spec.softwareNote}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <OneWireConclusionScorecard batchSize={batchSize} />
      <OneWireKicadBomPinout />
      <OneWireAuditHistory />
    </div>
  );
}
