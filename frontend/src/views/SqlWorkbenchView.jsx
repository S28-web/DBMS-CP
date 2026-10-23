import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Play,
  Copy,
  Check,
  Zap,
  BarChart3,
  Clock,
  Database,
  Layers,
  ArrowRight,
  ShieldCheck,
  Search
} from 'lucide-react';

export default function SqlWorkbenchView() {
  const [queries, setQueries] = useState([]);
  const [selectedQueryId, setSelectedQueryId] = useState('Q1');
  const [sqlText, setSqlText] = useState('');
  const [result, setResult] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [benchmark, setBenchmark] = useState(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load predefined queries
  useEffect(() => {
    fetch('/api/sql/queries')
      .then(res => res.json())
      .then(data => {
        setQueries(data);
        if (data.length > 0) {
          setSelectedQueryId(data[0].id);
          setSqlText(data[0].sql);
          // Auto execute initial query
          runQuery(data[0].sql);
        }
      })
      .catch(err => console.error('Failed to load queries:', err));

    // Load initial benchmark
    fetch('/api/benchmark')
      .then(res => res.json())
      .then(data => setBenchmark(data))
      .catch(err => console.error('Failed to load benchmark:', err));
  }, []);

  const handleSelectQuery = (q) => {
    setSelectedQueryId(q.id);
    setSqlText(q.sql);
    runQuery(q.sql);
  };

  const runQuery = (sqlToRun) => {
    setExecuting(true);
    fetch('/api/sql/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sqlToRun || sqlText })
    })
      .then(res => res.json())
      .then(data => {
        setResult(data);
        setExecuting(false);
      })
      .catch(err => {
        setResult({
          success: false,
          error: String(err),
          rows: [],
          columns: [],
          duration_ms: 0
        });
        setExecuting(false);
      });
  };

  const handleRunBenchmark = () => {
    setBenchmarking(true);
    fetch('/api/benchmark')
      .then(res => res.json())
      .then(data => {
        setBenchmark(data);
        setBenchmarking(false);
      })
      .catch(err => {
        console.error('Benchmark failed:', err);
        setBenchmarking(false);
      });
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="platform-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                DBMS SQL WORKBENCH &amp; PERFORMANCE BENCHMARK
              </span>
              <span className="text-xs font-mono text-slate-400">
                PostgreSQL 15+ &amp; SQLite Unified Engine
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Course Project SQL Analytical Queries (Q1–Q6) &amp; B-Tree Index Benchmark
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Execute all mandatory DBMS course project queries live against the 21-table normalized schema.
              Includes Recursive CTEs (<code className="text-sky-300 bg-space-950 px-1 py-0.5 rounded font-mono">WITH RECURSIVE</code>),
              self-joins, outer joins, and verifiable query plan latency profiling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBenchmark}
              disabled={benchmarking}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-glow transition-all"
            >
              <BarChart3 className={`w-4 h-4 ${benchmarking ? 'animate-spin' : ''}`} />
              <span>{benchmarking ? 'BENCHMARKING...' : 'RUN 10,500-ROW BENCHMARK'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 10,500-Row Index Benchmark Visualizer */}
      {benchmark && (
        <div className="platform-card rounded-2xl p-6 space-y-4 border-slate-700/60 bg-gradient-to-b from-space-850 to-space-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                Composite B-Tree Index Verification (10,500 Rows)
              </span>
              <p className="text-xs text-slate-400 font-mono">
                Index: <span className="text-sky-300">idx_observation_payload_start</span> ON observation(payload_id, start_time, end_time)
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {benchmark.speedup_factor}x Speedup
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">PostgreSQL Baseline: 5.6x</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* Without Index */}
            <div className="bg-space-950 p-4 rounded-xl border border-rose-900/40 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">1. FULL SEQUENTIAL SCAN</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-bold">NO INDEX</span>
              </div>
              <div className="text-2xl font-bold text-rose-400">
                {benchmark.latency_no_index_ms} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-snug">
                Scans all 10,500 observation rows + temporary B-tree file sort
              </div>
            </div>

            {/* With Index */}
            <div className="bg-space-950 p-4 rounded-xl border border-emerald-900/40 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">2. COMPOSITE B-TREE SCAN</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">INDEXED</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                {benchmark.latency_with_index_ms} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-snug">
                Logarithmic B-tree lookup with direct covering index range search
              </div>
            </div>

            {/* Speedup Factor */}
            <div className="bg-space-950 p-4 rounded-xl border border-sky-900/40 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">3. PERFORMANCE GAIN</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 font-bold">RATIO</span>
              </div>
              <div className="text-2xl font-bold text-sky-300">
                {benchmark.speedup_factor}x <span className="text-xs font-normal text-slate-400">FASTER</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-snug">
                Verified against 10,500 synthetic multi-payload observations
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Query Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {queries.map((q) => {
          const isSelected = selectedQueryId === q.id;
          return (
            <button
              key={q.id}
              onClick={() => handleSelectQuery(q)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all border ${
                isSelected
                  ? 'bg-sky-600 text-white border-sky-400 shadow-glow'
                  : 'bg-space-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              {q.id}: {q.title.split(':')[1]?.trim() || q.title}
            </button>
          );
        })}
      </div>

      {/* SQL Editor Console */}
      <div className="platform-card rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400 font-semibold flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-sky-400" />
            SQL CONSOLE (EDITABLE)
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={copyQuery}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Copy SQL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>

            <button
              onClick={() => runQuery(sqlText)}
              disabled={executing}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-glow"
            >
              <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : ''}`} />
              <span>{executing ? 'EXECUTING...' : 'RUN QUERY'}</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            rows={8}
            className="w-full bg-space-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-sky-300 focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
          />
        </div>
      </div>

      {/* Query Results & Execution Plan */}
      <div className="platform-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Query Results Table
            </h3>
          </div>

          {result && (
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {result.row_count} Rows Returned
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                ⚡ {result.duration_ms} ms
              </span>
            </div>
          )}
        </div>

        {executing ? (
          <div className="py-12 text-center font-mono text-xs text-sky-400 animate-pulse">
            Executing SQL query...
          </div>
        ) : result && !result.success ? (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 font-mono text-xs">
            <span className="font-bold">SQL Execution Error:</span> {result.error}
          </div>
        ) : result && result.rows && result.rows.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-space-950 border-b border-slate-800 text-slate-400 text-[11px]">
                  <tr>
                    {result.columns.map((col, idx) => (
                      <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                        {col.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {result.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-800/40">
                      {row.map((val, colIdx) => (
                        <td key={colIdx} className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                          {val !== null && val !== undefined ? String(val) : 'NULL'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Query Plan / EXPLAIN Output */}
            {result.query_plan && result.query_plan.length > 0 && (
              <div className="bg-space-950/90 border border-slate-800 p-3 rounded-xl space-y-1 font-mono text-[11px]">
                <div className="text-slate-500 text-[10px] uppercase font-bold">
                  EXPLAIN QUERY PLAN EXECUTION TREE:
                </div>
                {result.query_plan.map((step, i) => (
                  <div key={i} className="text-slate-400 flex items-center gap-1.5">
                    <span className="text-sky-500 font-bold">↳</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center font-mono text-xs text-slate-500">
            0 rows returned.
          </div>
        )}
      </div>
    </div>
  );
}
