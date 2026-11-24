import React from 'react';

export type WorkspaceView = 'comparison' | 'simulator';

interface HeaderProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView, anchor?: string) => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeView, onSelectView, onReset }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('comparison', 'top');
          }}
          className="text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          CoSTOS Hardware Lab
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a
            href="#comparison-table"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('comparison', 'comparison-table');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeView === 'comparison'
                ? 'text-slate-900 border-blue-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Comparison Table
          </a>
          <a
            href="#pros-cons"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('comparison', 'pros-cons');
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
          >
            Pros &amp; Cons
          </a>
          <a
            href="#simulator"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('simulator', 'simulator');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeView === 'simulator'
                ? 'text-slate-900 border-blue-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Live Simulator
          </a>
          <a
            href="#bom"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('simulator', 'bom');
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
          >
            BOM &amp; Safety
          </a>
          <a
            href="#conclusion"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('comparison', 'conclusion');
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
          >
            Conclusion
          </a>
          <a
            href="#kicad-bom"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('comparison', 'kicad-bom');
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
          >
            KiCad BOM
          </a>
          <a
            href="#audit-history"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('comparison', 'audit-history');
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
          >
            Audit History
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Reset Bench
          </button>
        </div>
      </div>
    </header>
  );
};
