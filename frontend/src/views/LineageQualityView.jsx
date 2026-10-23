import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Award,
  Zap
} from 'lucide-react';

export default function LineageQualityView() {
  const [lineage, setLineage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/lineage')
      .then(res => res.json())
      .then(data => {
        setLineage(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load lineage:', err);
        setLoading(false);
      });
  }, []);

  const sampleChains = [
    {
      payload: 'VELC (Coronagraph)',
      l0: 'AL1_VELC_20260926T230012_L0_CONT_V1.0',
      pipe1: 'VELC_L0_TO_L1_CALIB (v2.4.1)',
      l1: 'AL1_VELC_20260926T230012_L1_CONT_V1.0',
      pipe2: 'VELC_L1_TO_L2_CME_DETECT (v1.8.0)',
      l2: 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0',
      cal: 'CAL_VELC_CONT_FLAT_2026Q3.fits',
      quality: '100% Completeness • SNR 68.2'
    },
    {
      payload: 'SUIT (UV Telescope)',
      l0: 'AL1_SUIT_20261015T133500_L0_NB03_V1.1',
      pipe1: 'SUIT_L0_TO_L1_WCS (v3.0.0)',
      l1: 'AL1_SUIT_20261015T134000_L1_NB03_V1.1',
      pipe2: 'SUIT_L1_TO_L2_RADIANCE (v3.1.0)',
      l2: 'AL1_SUIT_20261015T134210_L2_NB03_V1.1',
      cal: 'CAL_SUIT_NB03_FLAT_2026Q4.fits',
      quality: '99.4% Completeness • SNR 88.0'
    },
    {
      payload: 'MAG (Tri-axial IMF)',
      l0: 'AL1_MAG_20261016T080000_L0_TS_V1.2',
      pipe1: 'MAG_L0_TO_L1_CLEAN (v2.1.0)',
      l1: 'AL1_MAG_20261016T080000_L1_CLEAN_V1.2',
      pipe2: 'MAG_L1_TO_L2_GRADIOMETER (v2.2.0)',
      l2: 'AL1_MAG_20261016T080000_L2_GSE_V1.2',
      cal: 'CAL_MAG_ZERO_OFFSET_202610.nc',
      quality: '100% Completeness • SNR 145.0'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="platform-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                DATA PROVENANCE &amp; QUALITY
              </span>
              <span className="text-xs font-mono text-slate-400">
                Recursive Pipeline Lineage DAG (L0 → L1 → L2)
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              End-to-End Scientific Provenance &amp; Calibration Tracking
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Provides verifiable scientific auditability from raw telemetry packets ($L0$) through radiometric calibrations ($L1$)
              to derived space-weather products ($L2$) across all 7 Aditya-L1 payloads.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-space-950/80 border border-slate-700/60 p-3 rounded-xl font-mono text-xs">
            <div>
              <div className="text-[10px] text-slate-400">LINEAGE HOPS</div>
              <div className="text-lg font-bold text-emerald-400">L0 → L1 → L2</div>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div>
              <div className="text-[10px] text-slate-400">QUALITY PASS RATE</div>
              <div className="text-lg font-bold text-sky-400">100%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Lineage DAG Pipeline Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          Representative Multi-Hop Processing Lineage DAGs
        </h3>

        <div className="space-y-4">
          {sampleChains.map((ch, idx) => (
            <div key={idx} className="platform-card rounded-2xl p-5 space-y-4 border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-mono font-bold text-sky-400">{ch.payload}</span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  {ch.quality}
                </span>
              </div>

              {/* 3-Hop Pipeline Card Layout */}
              <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-2 text-xs font-mono">
                {/* L0 Node */}
                <div className="bg-space-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">RAW TELEMETRY</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">L0</span>
                  </div>
                  <div className="text-sky-300 font-semibold truncate text-[11px]">{ch.l0}</div>
                  <div className="text-[10px] text-slate-500">ISSDC PRADAN Ingested</div>
                </div>

                {/* Arrow 1 */}
                <div className="flex justify-center text-slate-500">
                  <div className="text-center">
                    <ArrowRight className="w-5 h-5 mx-auto text-sky-400 animate-pulse" />
                    <span className="text-[9px] text-slate-400 truncate block max-w-[120px]">{ch.pipe1}</span>
                  </div>
                </div>

                {/* L1 Node */}
                <div className="bg-space-950 p-3 rounded-xl border border-sky-900/40 space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">CALIBRATED SCIENCE</span>
                    <span className="px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800">L1</span>
                  </div>
                  <div className="text-white font-semibold truncate text-[11px]">{ch.l1}</div>
                  <div className="text-[10px] text-slate-400">Cal: {ch.cal}</div>
                </div>

                {/* Arrow 2 */}
                <div className="flex justify-center text-slate-500">
                  <div className="text-center">
                    <ArrowRight className="w-5 h-5 mx-auto text-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-slate-400 truncate block max-w-[120px]">{ch.pipe2}</span>
                  </div>
                </div>

                {/* L2 Node */}
                <div className="bg-space-950 p-3 rounded-xl border border-emerald-900/40 space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">DERIVED SCIENCE</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">L2</span>
                  </div>
                  <div className="text-emerald-300 font-semibold truncate text-[11px]">{ch.l2}</div>
                  <div className="text-[10px] text-slate-400">Validated Quality Record</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Records Table */}
      <div className="platform-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Quality Control &amp; Signal-to-Noise Verification (quality_record Table)
          </h3>
          <span className="text-xs font-mono text-slate-400">10 Verified Products</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2">PRODUCT IDENTIFIER</th>
                <th className="pb-2">STATUS</th>
                <th className="pb-2">COMPLETENESS</th>
                <th className="pb-2">MISSING PKTS</th>
                <th className="pb-2">SNR ESTIMATE</th>
                <th className="pb-2">ANOMALY / VALIDATION NOTES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 font-semibold text-sky-300">AL1_VELC_20261015T135500_L2_CMEKIN_V1.2</td>
                <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">PASSED</span></td>
                <td className="py-2.5 text-white font-semibold">99.85%</td>
                <td className="py-2.5 text-slate-400">2</td>
                <td className="py-2.5 text-amber-400 font-bold">74.1</td>
                <td className="py-2.5 text-slate-300">High-contrast halo CME front captured</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 font-semibold text-sky-300">AL1_SUIT_20261015T134210_L2_NB03_V1.1</td>
                <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">WARN_PASS</span></td>
                <td className="py-2.5 text-white font-semibold">99.40%</td>
                <td className="py-2.5 text-slate-400">5</td>
                <td className="py-2.5 text-amber-400 font-bold">88.0</td>
                <td className="py-2.5 text-slate-300">Minor saturation in 12 core flare ribbon pixels during X2.4 peak</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 font-semibold text-sky-300">AL1_MAG_20261016T080000_L2_GSE_V1.2</td>
                <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">PASSED</span></td>
                <td className="py-2.5 text-white font-semibold">100.00%</td>
                <td className="py-2.5 text-slate-400">0</td>
                <td className="py-2.5 text-amber-400 font-bold">145.0</td>
                <td className="py-2.5 text-slate-300">Zero boom interference residual; sharp southward Bz rotation</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 font-semibold text-sky-300">AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1</td>
                <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">PASSED</span></td>
                <td className="py-2.5 text-white font-semibold">100.00%</td>
                <td className="py-2.5 text-slate-400">0</td>
                <td className="py-2.5 text-amber-400 font-bold">91.0</td>
                <td className="py-2.5 text-slate-300">Clear interplanetary shock jump in proton bulk velocity</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
