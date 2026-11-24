import { useState } from 'react';
import { Pt1000Workspace } from './hardware/01-PT1000/Pt1000Workspace';
import { OneWireWorkspace } from './hardware/02-OneWire/OneWireWorkspace';
import { PumpSupplyWorkspace } from './hardware/03-PumpSupply/PumpSupplyWorkspace';
import { WatchdogWorkspace } from './hardware/04-Watchdog/WatchdogWorkspace';
import { OutputStageWorkspace } from './hardware/05-OutputStage/OutputStageWorkspace';
import { PowerEntryWorkspace } from './hardware/06-PowerEntry/PowerEntryWorkspace';
import { ConnectorsWorkspace } from './hardware/07-Connectors/ConnectorsWorkspace';
import { FullHatWorkspace } from './hardware/08-FullHat/FullHatWorkspace';
import { HatSizeWorkspace } from './hardware/09-HatSize/HatSizeWorkspace';
import { HatPreviewWorkspace } from './hardware/10-HatPreview/HatPreviewWorkspace';
import { ArchitectureCompareWorkspace } from './hardware/11-DiscreteVsIC/ArchitectureCompareWorkspace';
import { SpiceVerificationWorkspace } from './hardware/12-SpiceVerification/SpiceVerificationWorkspace';
import type { HatEdition } from './hardware/08-FullHat/data/masterBom';

type SubsystemId =
  | 'pt1000'
  | 'onewire'
  | 'pump-supply'
  | 'watchdog'
  | 'output-stage'
  | 'power-entry'
  | 'connectors'
  | 'full-hat'
  | 'hat-size'
  | 'hat-preview'
  | 'arch-compare'
  | 'spice-verify';

export default function App() {
  const [subsystem, setSubsystem] = useState<SubsystemId>('full-hat');
  const [hatEdition, setHatEdition] = useState<HatEdition>('onewire');

  const navItems: { id: SubsystemId; label: string; activeClass: string }[] = [
    { id: 'pt1000', label: '01. Pt1000 Collector', activeClass: 'bg-blue-600 text-white' },
    { id: 'onewire', label: '02. 1-Wire Buses', activeClass: 'bg-cyan-600 text-white' },
    { id: 'pump-supply', label: '03. Pump PWM Supply', activeClass: 'bg-emerald-600 text-white' },
    { id: 'watchdog', label: '04. Hardware Watchdog', activeClass: 'bg-amber-600 text-white' },
    { id: 'output-stage', label: '05. Pump PWM Out & Relays', activeClass: 'bg-violet-600 text-white' },
    { id: 'power-entry', label: '06. Pi Power & Rail Budget', activeClass: 'bg-rose-600 text-white' },
    { id: 'connectors', label: '07. Connectors', activeClass: 'bg-orange-600 text-white' },
    { id: 'full-hat', label: '08. Costs, BOM & KiCad/SPICE', activeClass: 'bg-teal-600 text-white' },
    { id: 'hat-size', label: '09. HAT Size (65 vs 85 mm)', activeClass: 'bg-sky-600 text-white' },
    { id: 'hat-preview', label: '10. HAT PCB & 3D Preview', activeClass: 'bg-indigo-600 text-white' },
    { id: 'arch-compare', label: '11. Discrete vs IC & Zero-Solder', activeClass: 'bg-slate-700 text-white' },
    { id: 'spice-verify', label: '12. Full SPICE Verification', activeClass: 'bg-emerald-700 text-white' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top-Level CoSTOS HAT Subsystem Switcher */}
      <div className="bg-slate-900 text-slate-200 border-b border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 min-h-11 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              CoSTOS 1-Wire HAT
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSubsystem(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                  subsystem === item.id
                    ? item.activeClass
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Subsystem Workspace */}
      <div className="flex-1">
        {subsystem === 'pt1000' && <Pt1000Workspace />}
        {subsystem === 'pump-supply' && <PumpSupplyWorkspace />}
        {subsystem === 'watchdog' && <WatchdogWorkspace />}
        {subsystem === 'onewire' && <OneWireWorkspace />}
        {subsystem === 'output-stage' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <OutputStageWorkspace />
          </div>
        )}
        {subsystem === 'power-entry' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <PowerEntryWorkspace />
          </div>
        )}
        {subsystem === 'connectors' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <ConnectorsWorkspace />
          </div>
        )}
        {subsystem === 'full-hat' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <FullHatWorkspace edition={hatEdition} onEditionChange={setHatEdition} />
          </div>
        )}
        {subsystem === 'hat-size' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <HatSizeWorkspace edition={hatEdition} onEditionChange={setHatEdition} />
          </div>
        )}
        {subsystem === 'hat-preview' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <HatPreviewWorkspace edition={hatEdition} onEditionChange={setHatEdition} />
          </div>
        )}
        {subsystem === 'arch-compare' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <ArchitectureCompareWorkspace edition={hatEdition} onEditionChange={setHatEdition} />
          </div>
        )}
        {subsystem === 'spice-verify' && (
          <div className="max-w-[1440px] mx-auto px-6 py-6">
            <SpiceVerificationWorkspace edition={hatEdition} onEditionChange={setHatEdition} />
          </div>
        )}
      </div>
    </div>
  );
}
