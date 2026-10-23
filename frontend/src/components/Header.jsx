import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, Satellite, ShieldCheck, Zap } from 'lucide-react';

export default function Header({ onPollTrigger, isPolling, lastViewState, liveConnected }) {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const d = String(now.getUTCDate()).padStart(2, '0');
      const m = months[now.getUTCMonth()];
      const y = now.getUTCFullYear();
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const mm = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      const localStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setUtcTime(`${d} ${m} ${y} • ${hh}:${mm}:${ss} UTC (${localStr} Local)`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-space-850/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 px-4 lg:px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mission Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 shadow-glow text-white">
            <Satellite className="w-6 h-6 animate-pulse" />
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base lg:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                ADITYA-L1
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  MISSION CONTROL
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 font-mono">
              <span>ISRO ISSDC PRADAN</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                Halo Orbit (1.496M km)
              </span>
            </p>
          </div>
        </div>

        {/* Center: Live UTC Clock & Telemetry Status */}
        <div className="hidden md:flex items-center space-x-4 bg-space-950/70 border border-slate-800/80 rounded-lg px-3.5 py-1.5">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-400">MISSION CLOCK:</span>
            <span className="font-semibold text-white tracking-wider">{utcTime || 'SYNCING UTC...'}</span>
          </div>
          <div className="h-4 w-px bg-slate-800"></div>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={liveConnected ? 'text-emerald-400' : 'text-amber-400'}>
              {liveConnected ? 'LIVE WS STREAM' : 'POLLING REST'}
            </span>
          </div>
        </div>

        {/* Right: ViewState Token & Poll Now Button */}
        <div className="flex items-center space-x-3">
          {lastViewState && (
            <div className="hidden xl:flex items-center space-x-1.5 bg-slate-900/80 border border-slate-700/60 rounded-md px-2.5 py-1 text-xs font-mono text-slate-400">
              <span className="text-slate-500">JSF ViewState:</span>
              <span className="text-sky-300 font-semibold">{lastViewState.slice(0, 14)}...</span>
            </div>
          )}

          <button
            id="pollPradanNowBtn"
            onClick={onPollTrigger}
            disabled={isPolling}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border ${
              isPolling
                ? 'bg-sky-950 text-sky-400 border-sky-800 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border-sky-400/40 shadow-glow hover:shadow-glow-lg'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-sky-300' : ''}`} />
            <span>{isPolling ? 'POLLING PRADAN...' : 'POLL NOW'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
