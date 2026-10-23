import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Radio,
  DatabaseZap,
  GitBranch,
  Terminal,
  Sun,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabSelect, spaceWeather }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Mission Dashboard',
      short: 'Dashboard',
      icon: LayoutDashboard,
      badge: 'LIVE'
    },
    {
      id: 'anomaly',
      label: '1. Anomaly & L1 Propagation',
      short: 'Anomaly Tracker',
      icon: Activity,
      badge: 'CME 24h'
    },
    {
      id: 'payloads',
      label: '2. 7-Payload Telemetry',
      short: '7 Payloads',
      icon: Radio,
      badge: '7/7 OK'
    },
    {
      id: 'pradan',
      label: '3. Relational Ingestion & ACID Txn',
      short: 'Relational Ingest',
      icon: DatabaseZap,
      badge: 'ACID Txn'
    },
    {
      id: 'lineage',
      label: '4. Provenance & Lineage DAG',
      short: 'Lineage DAG',
      icon: GitBranch,
      badge: 'L0→L2'
    },
    {
      id: 'sql',
      label: '5. DBMS SQL & Benchmarks',
      short: 'SQL Workbench',
      icon: Terminal,
      badge: 'Q1–Q6'
    }
  ];

  return (
    <aside className="w-64 bg-space-850/95 border-r border-slate-800/80 flex flex-col justify-between shrink-0">
      <div className="p-4 space-y-6">
        {/* Navigation Category Label */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2.5 px-2">
            Navigation Console
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 text-left ${
                    isActive
                      ? 'sidebar-item-active text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Space Weather Status Monitor */}
        <div className="platform-card rounded-xl p-3.5 space-y-2.5 border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              L1 Space Weather
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              QUIET
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-space-950/60 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500">SOLAR WIND</div>
              <div className="text-white font-semibold text-xs mt-0.5">
                {spaceWeather?.solar_wind_speed_kms || 482.5} <span className="text-[10px] text-slate-400">km/s</span>
              </div>
            </div>
            <div className="bg-space-950/60 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500">IMF |B| TOTAL</div>
              <div className="text-sky-300 font-semibold text-xs mt-0.5">
                {spaceWeather?.imf_btotal_nt || 6.8} <span className="text-[10px] text-slate-400">nT</span>
              </div>
            </div>
            <div className="bg-space-950/60 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500">IMF BZ (GSE)</div>
              <div className={`font-semibold text-xs mt-0.5 ${(spaceWeather?.imf_bz_nt || -1.4) < -10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {spaceWeather?.imf_bz_nt || -1.4} <span className="text-[10px] text-slate-400">nT</span>
              </div>
            </div>
            <div className="bg-space-950/60 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500">GOES X-RAY</div>
              <div className="text-amber-400 font-semibold text-xs mt-0.5">
                {spaceWeather?.xray_flux_class || 'C2.1'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] font-mono text-slate-500 flex items-center justify-between">
        <span>DBMS CP • PostgreSQL 15+</span>
        <span className="text-emerald-400">v2.0</span>
      </div>
    </aside>
  );
}
