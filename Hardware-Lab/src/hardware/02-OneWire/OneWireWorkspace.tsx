import { useMemo, useState } from 'react';
import {
  DEFAULT_ONEWIRE_PARAMS,
  ONEWIRE_TOPOLOGY_SPECS,
  OneWireSimParams,
  OneWireTopologyId,
  evaluateOneWireBus,
  oneWirePerBoardCostEur,
} from './physics/model';
import { OneWireComparisonBoard } from './components/ComparisonBoard';
import { OneWireControlConsole } from './components/ControlConsole';
import { OneWireCircuitSvg } from './components/CircuitDiagramSvg';
import { OneWireSweepChart } from './components/SweepChart';
import { exportOneWirePdfReport } from './utils/exportPdfReport';

type OneWireViewMode = 'comparison' | 'simulator';

export function OneWireWorkspace() {
  const [activeView, setActiveView] = useState<OneWireViewMode>('comparison');
  const [selectedTopology, setSelectedTopology] =
    useState<OneWireTopologyId>('gemini_rev_b_2n7002');
  const [params, setParams] = useState<OneWireSimParams>(DEFAULT_ONEWIRE_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(2);

  const result = useMemo(
    () => evaluateOneWireBus(selectedTopology, params),
    [selectedTopology, params]
  );

  const activeSpec = ONEWIRE_TOPOLOGY_SPECS[selectedTopology];
  const revACost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.rev_a_baseline, batchSize);
  const activeCost = oneWirePerBoardCostEur(activeSpec, batchSize);

  const handleSelectView = (view: OneWireViewMode, anchor?: string) => {
    setActiveView(view);
    if (anchor) {
      window.requestAnimationFrame(() => {
        if (anchor === 'onewire-top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  };

  const handleInspectInSimulator = (id: OneWireTopologyId) => {
    setSelectedTopology(id);
    setActiveView('simulator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSelectedTopology('gemini_rev_b_2n7002');
    setParams(DEFAULT_ONEWIRE_PARAMS);
    setBatchSize(2);
  };

  const handleExportPdf = () => {
    exportOneWirePdfReport(selectedTopology, params, batchSize);
  };

  return (
    <div id="onewire-top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Subsystem Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <a
            href="#onewire-top"
            onClick={(e) => {
              e.preventDefault();
              handleSelectView('comparison', 'onewire-top');
            }}
            className="text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            02. 1-Wire Bus &amp; Protection Lab
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#onewire-comparison-table"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'onewire-comparison-table');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeView === 'comparison'
                  ? 'text-slate-900 border-cyan-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Comparison Table
            </a>
            <a
              href="#onewire-pros-cons"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'onewire-pros-cons');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Pros &amp; Cons
            </a>
            <a
              href="#onewire-simulator"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('simulator', 'onewire-simulator');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeView === 'simulator'
                  ? 'text-slate-900 border-cyan-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Live Simulator
            </a>
            <a
              href="#onewire-kicad-bom"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'onewire-kicad-bom');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              KiCad BOM
            </a>
            <a
              href="#onewire-audit-history"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'onewire-audit-history');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Audit History
            </a>
          </nav>

          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Bench
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Workspace Headline & Mode Switcher */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
              Hardening CoSTOS 1-Wire Buses (Rev A → Rev B · Gemini Version)
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Audits CoSTOS HAT-1wire.md §4.4 (3.3 V direct w1-gpio + shared F2 PTC + PESD5V0) against a 100% JLCPCB Basic 5 V diode-biased 2N7002 + per-bus SS14/100 Ω architecture and DS2482 I²C bridge across 2–80 m shielded boiler-room cable runs and 6 wiring/ESD fault corners.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveView('comparison')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeView === 'comparison'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Table &amp; Detailed Pros/Cons
              </button>
              <button
                type="button"
                onClick={() => setActiveView('simulator')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeView === 'simulator'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Circuit Simulator
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              Export 9-Page PDF Report
            </button>
          </div>
        </div>

        {activeView === 'comparison' ? (
          <OneWireComparisonBoard
            params={params}
            batchSize={batchSize}
            onChangeBatchSize={setBatchSize}
            onInspectInSimulator={handleInspectInSimulator}
          />
        ) : (
          <div id="onewire-simulator" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4">
              <OneWireControlConsole
                selectedTopology={selectedTopology}
                onSelectTopology={setSelectedTopology}
                params={params}
                onChangeParams={setParams}
              />
            </div>

            <div className="lg:col-span-8 space-y-5">
              {/* Live Telemetry Readout Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500">
                    V_Pi @ Sample
                  </div>
                  <div
                    className={`text-xl font-mono font-semibold tabular-nums mt-1 ${
                      result.piVihMarginV >= 0.3
                        ? 'text-emerald-700'
                        : result.piVihMarginV >= 0
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {result.vPiAtSampleV.toFixed(2)} V
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Margin {result.piVihMarginV >= 0 ? '+' : ''}
                    {result.piVihMarginV.toFixed(2)} V
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500">
                    Sensor VDD / V_OL
                  </div>
                  <div
                    className={`text-xl font-mono font-semibold tabular-nums mt-1 ${
                      result.sensorVddOk && result.vOlOk ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {result.sensorVddV.toFixed(2)} V
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    V_OL = {result.vOlAtPiV.toFixed(2)} V (≤0.80)
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500">
                    Max Cable Reach
                  </div>
                  <div className="text-xl font-mono font-semibold text-cyan-800 tabular-nums mt-1">
                    {result.maxReachM.toFixed(0)} m
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    τ = {result.tauUs.toFixed(1)} µs ({result.busCapNf.toFixed(2)} nF)
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500">
                    Pi GPIO Peak / Cost
                  </div>
                  <div
                    className={`text-xl font-mono font-semibold tabular-nums mt-1 ${
                      result.piGpioPeakV <= 3.63 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {result.piGpioPeakV.toFixed(2)} V
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    €{activeCost.toFixed(2)}/bd (vs €{revACost.toFixed(2)})
                  </div>
                </div>
              </div>

              {/* Active Fault / Margin Banner */}
              <div
                className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${
                  result.faultVerdict === 'PASS'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : result.faultVerdict === 'MARGINAL'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-rose-50/80 border-rose-300 text-rose-950'
                }`}
              >
                <span className="font-mono font-semibold uppercase mr-2">[{result.faultVerdict}]</span>
                {result.faultSummary}
                {result.vGateBiasV !== null && result.vGsOverdriveV !== null && (
                  <span className="block font-mono text-[11px] mt-1 opacity-90">
                    Shared Gate Bias V_G = {result.vGateBiasV.toFixed(2)} V · Worst-Case V_th Overdrive ={' '}
                    {result.vGsOverdriveV >= 0 ? '+' : ''}
                    {result.vGsOverdriveV.toFixed(2)} V · Bus B Online = {result.busBAliveDuringFault ? 'YES' : 'NO'}
                  </span>
                )}
              </div>

              <OneWireCircuitSvg topologyId={selectedTopology} result={result} />
              <OneWireSweepChart params={params} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
