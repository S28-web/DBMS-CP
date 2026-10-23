import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Database,
  Flame,
  Hash,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardView({ status, payloads, events, onSelectPayload, liveTelemetry }) {
  // Rolling time series data for MAG chart
  const [magHistory, setMagHistory] = useState({
    labels: ['14:20:00', '14:20:10', '14:20:20', '14:20:30', '14:20:40', '14:20:50'],
    bx: [3.4, 3.2, 3.8, 3.5, 3.1, 3.4],
    by: [-2.1, -2.4, -1.9, -2.2, -2.0, -2.1],
    bz: [1.8, 1.2, -0.5, -1.8, -2.4, -1.4],
    btotal: [4.4, 4.2, 4.3, 4.5, 4.6, 4.5]
  });

  // Update chart when live telemetry packet arrives
  useEffect(() => {
    if (!liveTelemetry || !liveTelemetry.mag) return;
    setMagHistory(prev => {
      const newLabels = [...prev.labels.slice(1), liveTelemetry.timestamp || new Date().toLocaleTimeString()];
      const newBx = [...prev.bx.slice(1), liveTelemetry.mag.bx];
      const newBy = [...prev.by.slice(1), liveTelemetry.mag.by];
      const newBz = [...prev.bz.slice(1), liveTelemetry.mag.bz];
      const newBtotal = [...prev.btotal.slice(1), liveTelemetry.mag.btotal];
      return {
        labels: newLabels,
        bx: newBx,
        by: newBy,
        bz: newBz,
        btotal: newBtotal
      };
    });
  }, [liveTelemetry]);

  // Chart configuration for MAG
  const magChartData = {
    labels: magHistory.labels,
    datasets: [
      {
        label: 'Bx (GSE)',
        data: magHistory.bx,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.05)',
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: 'By (GSE)',
        data: magHistory.by,
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: 'Bz (GSE)',
        data: magHistory.bz,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 3,
      },
      {
        label: '|B| Total',
        data: magHistory.btotal,
        borderColor: '#10b981',
        borderDash: [4, 4],
        backgroundColor: 'transparent',
        tension: 0.35,
        borderWidth: 1.5,
        pointRadius: 1,
      }
    ]
  };

  const magChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: 'JetBrains Mono', size: 10 },
          boxWidth: 12
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#0f172a',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        borderWidth: 1,
        titleFont: { family: 'JetBrains Mono' },
        bodyFont: { family: 'JetBrains Mono' }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  // Solar X-Ray Flux Data
  const xrayData = {
    labels: ['13:00', '13:15', '13:30', '13:40', '13:45', '13:48', '14:00', '14:15', '14:30'],
    datasets: [
      {
        label: 'SoLEXS (1-10 keV Thermal)',
        data: [1.2e-6, 1.5e-6, 4.2e-5, 1.4e-4, 3.8e-4, 4.8e-4, 2.1e-4, 6.5e-5, 2.0e-5],
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
      },
      {
        label: 'HEL1OS (25-50 keV Hard X-Ray)',
        data: [0.8e-7, 1.0e-7, 1.5e-6, 8.5e-5, 4.8e-4, 2.2e-4, 5.0e-6, 1.2e-6, 0.9e-7],
        borderColor: '#14b8a6',
        backgroundColor: 'transparent',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
      }
    ]
  };

  const xrayOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: 'JetBrains Mono', size: 10 },
          boxWidth: 12
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        type: 'logarithmic',
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner: Sun -> L1 Halo Orbit */}
      <div className="platform-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-40 top-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVE HALO ORBIT
              </span>
              <span className="text-xs font-mono text-slate-400">Sun-Earth L1 Lagrange Point</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-white">
              Aditya-L1 Solar Telemetry &amp; Anomaly Processing Platform
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              India's maiden solar observatory operating at Sun–Earth Lagrange Point L1 (~1.5 million km from Earth).
              Automated ingestion from ISRO ISSDC PRADAN portal with stateful JSF session parsing, transactional ON CONFLICT deduplication,
              and 21-table normalized PostgreSQL relational DBMS analysis.
            </p>
          </div>

          <div className="bg-space-950/80 border border-slate-700/60 rounded-xl p-4 shrink-0 font-mono text-xs space-y-2 min-w-[260px]">
            <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>ORBITAL CHECKLIST</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Station Distance:</span>
              <span className="font-semibold text-white">1,496,000 km</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Halo Period:</span>
              <span className="font-semibold text-white">177.86 Days</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Solar Pointing:</span>
              <span className="font-semibold text-emerald-400">Sun-Center Locked</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Telemetry Stream:</span>
              <span className="font-semibold text-sky-400">8.0 Hz Continuous</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Active Payloads */}
        <div className="platform-card rounded-xl p-4 border-slate-800 hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium">ACTIVE PAYLOADS</span>
            <Radio className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {status?.active_payloads || 7} <span className="text-xs font-normal text-slate-400">/ 7</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
            <span>4 Remote + 3 In-Situ</span>
          </div>
        </div>

        {/* Card 2: Ingested Products */}
        <div className="platform-card rounded-xl p-4 border-slate-800 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium">SCIENCE PRODUCTS</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {status?.total_products || 18}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            <span>FITS, CDF &amp; NetCDF-4</span>
          </div>
        </div>

        {/* Card 3: Observations */}
        <div className="platform-card rounded-xl p-4 border-slate-800 hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium">OBSERVATIONS</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {status?.total_observations || 8}
          </div>
          <div className="text-[11px] font-mono text-sky-400 mt-1">
            <span>Indexed across 7 sensors</span>
          </div>
        </div>

        {/* Card 4: Solar Events */}
        <div className="platform-card rounded-xl p-4 border-slate-800 hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium">SOLAR ANOMALIES</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {status?.solar_events_detected || 3}
          </div>
          <div className="text-[11px] font-mono text-amber-400 mt-1">
            <span>X2.4 Flare &amp; Halo CME</span>
          </div>
        </div>

        {/* Card 5: DBMS Relational Architecture (21 Tables, 3NF) */}
        <div className="platform-card rounded-xl p-4 border-slate-800 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium">RELATIONAL SCHEMA</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            21 <span className="text-xs font-normal text-slate-400">Tables</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1">
            <span>3NF Normalized • B-Tree Index</span>
          </div>
        </div>
      </div>

      {/* Dual Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Solar X-Ray Flux */}
        <div className="platform-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                Solar X-Ray Flux Spectrum (SoLEXS &amp; HEL1OS)
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Multi-band flare light curve during impulsive phase (W/m²)
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
              X2.4 Flare Peak
            </span>
          </div>
          <div className="h-64">
            <Line data={xrayData} options={xrayOptions} />
          </div>
        </div>

        {/* Chart 2: Real-time Magnetometer GSE IMF Vectors */}
        <div className="platform-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Real-Time Aditya-L1 IMF Vector (MAG GSE Frame)
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Live 8.0 Hz tri-axial fluxgate magnetometer streaming (nT)
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              Live Stream
            </span>
          </div>
          <div className="h-64">
            <Line data={magChartData} options={magChartOptions} />
          </div>
        </div>
      </div>

      {/* 7-Payload Mini Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wide uppercase font-mono text-slate-300">
            Aditya-L1 Science Payload Suite (7 Instruments)
          </h3>
          <span className="text-xs font-mono text-slate-400">
            4 Remote-Sensing • 3 In-Situ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {payloads && payloads.map(p => {
            const isRemote = p.payload_category === 'REMOTE_SENSING';
            return (
              <div
                key={p.payload_code}
                onClick={() => onSelectPayload(p.payload_code)}
                className="platform-card rounded-xl p-3.5 space-y-2 cursor-pointer border-slate-800 hover:border-sky-400/50 hover:bg-slate-800/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold font-mono text-white group-hover:text-sky-300 transition-colors">
                    {p.payload_code}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    isRemote ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                  }`}>
                    {isRemote ? 'REMOTE' : 'IN-SITU'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2 h-8 leading-snug">
                  {p.name}
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{p.product_count || 2} Products</span>
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    NOMINAL
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Solar Events Table */}
      <div className="platform-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Recent Aditya-L1 Solar Anomaly Detections &amp; Correlation Campaign
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Cross-payload correlated solar flares, coronal mass ejections, and interplanetary shock wave arrivals
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Oct 15–16 Campaign
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2">EVENT CODE</th>
                <th className="pb-2">TYPE</th>
                <th className="pb-2">SEVERITY</th>
                <th className="pb-2">ACTIVE REGION</th>
                <th className="pb-2">ONSET (UTC)</th>
                <th className="pb-2">CONFIDENCE</th>
                <th className="pb-2">CROSS-PAYLOAD EVIDENCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {events && events.map(ev => (
                <tr key={ev.event_code} className="hover:bg-slate-800/40">
                  <td className="py-2.5 font-semibold text-sky-400">{ev.event_code}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                      {ev.event_type}
                    </span>
                  </td>
                  <td className="py-2.5 font-bold text-amber-400">{ev.severity_class}</td>
                  <td className="py-2.5 text-slate-300">{ev.source_active_reg} ({ev.heliographic_coord})</td>
                  <td className="py-2.5 text-slate-400">{ev.onset_time}</td>
                  <td className="py-2.5 text-emerald-400">{(ev.confidence_score * 100).toFixed(1)}%</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {ev.evidence_products && ev.evidence_products.map(ep => (
                        <span key={ep.link_id} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-800/60 text-sky-300">
                          {ep.payload_code} ({ep.evidence_role})
                        </span>
                      ))}
                    </div>
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
