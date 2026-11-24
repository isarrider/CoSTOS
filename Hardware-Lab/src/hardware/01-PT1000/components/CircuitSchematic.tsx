import React from 'react';
import {
  SimulationParams,
  SimulationResult,
  TOPOLOGY_SPECS,
  TopologyId,
} from '../physics/model';
import { CircuitDiagramSvg } from './CircuitDiagramSvg';

interface CircuitSchematicProps {
  topologyId: TopologyId;
  params: SimulationParams;
  result: SimulationResult;
}

export const CircuitSchematic: React.FC<CircuitSchematicProps> = ({
  topologyId,
  params,
  result,
}) => {
  const spec = TOPOLOGY_SPECS[topologyId];

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{spec.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{spec.summary}</p>
        </div>
        <div className="text-xs font-mono text-slate-500 whitespace-nowrap shrink-0">
          <span>{spec.interfacePins}</span>
          <span aria-hidden="true" className="mx-1.5">·</span>
          <span>{spec.handSolderability}</span>
        </div>
      </div>

      {/* Live Electronic Circuit Diagram */}
      <CircuitDiagramSvg topologyId={topologyId} params={params} result={result} />

      {/* Live Node Telemetry Strip */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {result.nodes.map((node) => (
          <div
            key={node.label}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between gap-2"
          >
            <div>
              <div className="text-[11px] font-medium text-slate-500">{node.label}</div>
              {node.note && <div className="text-[11px] text-slate-500 mt-0.5">{node.note}</div>}
            </div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900">
              {node.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
