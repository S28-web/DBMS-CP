import React, { useState, useEffect } from 'react';
import {
  DatabaseZap,
  RefreshCw,
  Hash,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Layers,
  Copy,
  Check
} from 'lucide-react';

export default function PradanIngestionView({ onPollTrigger, isPolling, lastPollResult }) {
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchRuns = () => {
    setLoadingRuns(true);
    fetch('/api/runs?limit=15')
      .then(res => res.json())
      .then(data => {
        setRuns(data);
        setLoadingRuns(false);
      })
      .catch(err => {
        console.error('Failed to fetch runs:', err);
        setLoadingRuns(false);
      });
  };

  useEffect(() => {
    fetchRuns();
  }, [lastPollResult]);

  const activeViewState = lastPollResult?.viewstate_token || 'e42b-35dd-4fc6-b92d-c18148a1d65d:0';
  const activeHash = lastPollResult?.viewstate_hash || '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="platform-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                <DatabaseZap className="w-3.5 h-3.5 text-cyan-400" />
                RELATIONAL INGESTION &amp; ACID PIPELINE
              </span>
              <span className="text-xs font-mono text-slate-400">
                browse.xhtml Scraper &amp; DBMS Transaction Engine
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              ISSDC PRADAN Telemetry Ingestion &amp; Relational ACID Transaction Engine
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Automates stateful session management across ISRO ISSDC PRADAN portal endpoints, extracting
              <code className="text-sky-300 bg-space-950 px-1.5 py-0.5 rounded mx-1 font-mono">javax.faces.ViewState</code>
              tokens, enforcing <code className="text-emerald-300 bg-space-950 px-1.5 py-0.5 rounded mx-1 font-mono">ON CONFLICT (product_identifier) DO NOTHING</code> unique key constraints,
              and executing atomic batch commits into PostgreSQL relational tables.
            </p>
          </div>

          <button
            onClick={onPollTrigger}
            disabled={isPolling}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wide transition-all border ${
              isPolling
                ? 'bg-sky-950 text-sky-400 border-sky-800 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border-sky-400/40 shadow-glow hover:shadow-glow-lg'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin text-sky-300' : ''}`} />
            <span>{isPolling ? 'EXECUTING TRANSACTION...' : 'TRIGGER RELATIONAL POLL'}</span>
          </button>
        </div>
      </div>

      {/* JSF Session & Relational Constraints State Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: JSF ViewState Token */}
        <div className="platform-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ACTIVE JSF VIEWSTATE
            </span>
            <button
              onClick={() => copyToClipboard(activeViewState)}
              className="text-slate-400 hover:text-white transition-colors"
              title="Copy token"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="bg-space-950/90 border border-slate-800 p-3 rounded-xl font-mono text-xs space-y-2">
            <div className="text-[10px] text-slate-500">javax.faces.ViewState TOKEN:</div>
            <div className="text-sky-300 break-all select-all font-semibold leading-relaxed">
              {activeViewState}
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 truncate">
            SHA-256: <span className="text-slate-400">{activeHash.slice(0, 32)}...</span>
          </div>
        </div>

        {/* Card 2: Relational Unique Constraint & Deduplication */}
        <div className="platform-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-400" />
              RELATIONAL UNIQUE CONSTRAINT
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              B-TREE UNIQUE KEY
            </span>
          </div>

          <div className="bg-space-950/90 border border-slate-800 p-3 rounded-xl font-mono text-center space-y-1">
            <div className="text-[10px] text-slate-500">UNIQUE IDENTIFIERS TRACKED</div>
            <div className="text-3xl font-bold text-white">
              {lastPollResult?.hash_set_size || 18}
            </div>
            <div className="text-[10px] text-emerald-400">ON CONFLICT (product_identifier) DO NOTHING</div>
          </div>

          <div className="text-[10px] font-mono text-slate-400 flex justify-between">
            <span>Discovered: {lastPollResult?.rows_discovered || 14}</span>
            <span className="text-rose-400">Duplicates Skipped: {lastPollResult?.rows_skipped_dup || 0}</span>
            <span className="text-emerald-400">Committed: {lastPollResult?.rows_inserted || 14}</span>
          </div>
        </div>

        {/* Card 3: Ingestion Window & Endpoint */}
        <div className="platform-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              PORTAL CONFIGURATION
            </span>
            <span className="text-[10px] font-mono text-sky-400">LIVE REST</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="bg-space-950/70 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-500">BROWSE URL</div>
              <div className="text-white truncate font-semibold">/al1/protected/browse.xhtml</div>
            </div>
            <div className="bg-space-950/70 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-500">ROLLING WINDOW</div>
              <div className="text-amber-300 font-semibold">Now - 1 hour (UTC Rolling)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingestion Runs Execution History Table */}
      <div className="platform-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            Ingestion Runs History (PostgreSQL ingestion_run Table)
          </h3>
          <span className="text-xs font-mono text-slate-400">{runs.length} Runs Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2">RUN ID</th>
                <th className="pb-2">TARGET</th>
                <th className="pb-2">WINDOW (UTC)</th>
                <th className="pb-2">STARTED</th>
                <th className="pb-2">DISCOVERED</th>
                <th className="pb-2">INSERTED</th>
                <th className="pb-2">SKIPPED DUP</th>
                <th className="pb-2">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {runs.map(r => (
                <tr key={r.ingestion_run_id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 font-bold text-sky-400">#{r.ingestion_run_id}</td>
                  <td className="py-2.5 text-slate-300">{r.payload_id ? `PAYLOAD #${r.payload_id}` : 'ALL 7 PAYLOADS'}</td>
                  <td className="py-2.5 text-slate-400 truncate max-w-[180px]">
                    {r.query_window_start.slice(0, 16)} → {r.query_window_end.slice(0, 16)}
                  </td>
                  <td className="py-2.5 text-slate-400">{r.started_at.slice(0, 19)}</td>
                  <td className="py-2.5 font-semibold text-white">{r.rows_discovered}</td>
                  <td className="py-2.5 font-semibold text-emerald-400">{r.rows_inserted}</td>
                  <td className="py-2.5 font-semibold text-rose-400">{r.rows_skipped_dup}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal Audit Log Stream */}
      <div className="platform-card rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400 font-semibold flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-sky-400" />
            LIVE INGESTION TERMINAL &amp; AUDIT LOG STREAM
          </span>
          <span className="text-[10px] font-mono text-slate-500">ingestion_log relational stream</span>
        </div>

        <div className="bg-space-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5 max-h-64 overflow-y-auto">
          {lastPollResult?.recent_logs && lastPollResult.recent_logs.length > 0 ? (
            lastPollResult.recent_logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-slate-500 select-none">[{i + 1}]</span>
                <span className={`font-bold ${
                  log.action === 'INSERTED' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  [{log.action}]
                </span>
                <span className="text-sky-300">{log.ident}</span>
                <span className="text-slate-400">— {log.msg}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic py-4 text-center">
              Terminal idle. Click "Trigger Rolling Poll" or "Poll Now" to initiate a real-time ingestion cycle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
