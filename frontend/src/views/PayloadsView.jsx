import React, { useState, useEffect } from 'react';
import {
  Radio,
  Sliders,
  Table,
  CheckCircle,
  FileCode,
  Layers,
  Sparkles,
  Database,
  Key,
  ShieldCheck,
  Zap,
  Code2,
  Copy,
  Check
} from 'lucide-react';

// Specialized DBMS Course Project Metadata & Relational Schema Dictionary
const PAYLOAD_DBMS_SCHEMA = {
  VELC: {
    table: 'velc_coronograph_measurement',
    primaryKey: 'measurement_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 8,
    indexes: [
      { name: 'pk_velc_measurement', type: 'B-Tree (Unique)', cols: 'measurement_id' },
      { name: 'idx_velc_product_time', type: 'Composite B-Tree', cols: 'product_id, sample_time DESC' },
      { name: 'idx_velc_fov_cme', type: 'Composite B-Tree', cols: 'heliocentric_fov_r_sun, cme_front_speed_kms' }
    ],
    checkConstraints: [
      'CHECK (heliocentric_fov_r_sun BETWEEN 1.05 AND 3.00)',
      'CHECK (position_angle_deg >= 0 AND position_angle_deg < 360)',
      'CHECK (linear_polarization_frac BETWEEN 0.0 AND 1.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, heliocentric_fov_r_sun, cme_front_speed_kms
FROM velc_coronograph_measurement
WHERE product_id = 2002 AND heliocentric_fov_r_sun > 1.2
ORDER BY sample_time DESC;`
  },
  SUIT: {
    table: 'suit_uv_filtergraph_image',
    primaryKey: 'image_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 7,
    indexes: [
      { name: 'pk_suit_image', type: 'B-Tree (Unique)', cols: 'image_id' },
      { name: 'idx_suit_product_time', type: 'Composite B-Tree', cols: 'product_id, sample_time DESC' },
      { name: 'idx_suit_active_region', type: 'Partial B-Tree', cols: 'active_region_detected WHERE active_region_detected = TRUE' }
    ],
    checkConstraints: [
      'CHECK (filter_wavelength_nm BETWEEN 200.0 AND 400.0)',
      'CHECK (exposure_duration_ms > 0)',
      'CHECK (flare_ribbon_brightness >= 0.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, filter_wavelength_nm, flare_ribbon_brightness
FROM suit_uv_filtergraph_image
WHERE active_region_detected = TRUE
ORDER BY sample_time DESC;`
  },
  SoLEXS: {
    table: 'solexs_xray_spectrum',
    primaryKey: 'spectrum_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 7,
    indexes: [
      { name: 'pk_solexs_spectrum', type: 'B-Tree (Unique)', cols: 'spectrum_id' },
      { name: 'idx_solexs_prod_time', type: 'Composite B-Tree', cols: 'product_id, sample_time DESC' },
      { name: 'idx_solexs_flux', type: 'B-Tree', cols: 'flux_wm2 DESC' }
    ],
    checkConstraints: [
      'CHECK (energy_bin_low_kev >= 1.0 AND energy_bin_high_kev <= 10.0)',
      'CHECK (photon_count >= 0)',
      'CHECK (plasma_temp_mk > 0.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, flux_wm2, plasma_temp_mk
FROM solexs_xray_spectrum
WHERE flux_wm2 > 1.0e-5
ORDER BY flux_wm2 DESC;`
  },
  HEL1OS: {
    table: 'hel1os_hard_xray_event',
    primaryKey: 'hxr_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 6,
    indexes: [
      { name: 'pk_hel1os_hxr', type: 'B-Tree (Unique)', cols: 'hxr_id' },
      { name: 'idx_hel1os_time', type: 'B-Tree', cols: 'sample_time DESC' },
      { name: 'idx_hel1os_energy', type: 'B-Tree', cols: 'energy_band_kev' }
    ],
    checkConstraints: [
      'CHECK (count_rate_cps >= 0)',
      'CHECK (spectral_index > 0.0)',
      'CHECK (non_thermal_cutoff_kev >= 10.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, count_rate_cps, spectral_index
FROM hel1os_hard_xray_event
WHERE spectral_index BETWEEN 2.0 AND 5.0
ORDER BY count_rate_cps DESC;`
  },
  ASPEX: {
    table: 'aspex_solar_wind_particle',
    primaryKey: 'particle_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 7,
    indexes: [
      { name: 'pk_aspex_particle', type: 'B-Tree (Unique)', cols: 'particle_id' },
      { name: 'idx_aspex_prod_time', type: 'Composite B-Tree', cols: 'product_id, sample_time DESC' },
      { name: 'idx_aspex_speed', type: 'B-Tree', cols: 'bulk_speed_kms DESC' }
    ],
    checkConstraints: [
      "CHECK (sensor_unit IN ('SWIS', 'STEPS'))",
      'CHECK (bulk_speed_kms > 0.0)',
      'CHECK (alpha_to_proton_ratio >= 0.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, bulk_speed_kms, proton_density_cm3
FROM aspex_solar_wind_particle
WHERE bulk_speed_kms > 500.0
ORDER BY sample_time DESC;`
  },
  PAPA: {
    table: 'papa_plasma_measurement',
    primaryKey: 'plasma_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 6,
    indexes: [
      { name: 'pk_papa_plasma', type: 'B-Tree (Unique)', cols: 'plasma_id' },
      { name: 'idx_papa_time', type: 'B-Tree', cols: 'sample_time DESC' },
      { name: 'idx_papa_sensor', type: 'B-Tree', cols: 'sensor_module' }
    ],
    checkConstraints: [
      "CHECK (sensor_module IN ('SWEEP', 'SWICAR'))",
      'CHECK (electron_density_cm3 >= 0.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, electron_density_cm3, ion_flux
FROM papa_plasma_measurement
WHERE electron_density_cm3 > 10.0
ORDER BY sample_time DESC;`
  },
  MAG: {
    table: 'mag_field_measurement',
    primaryKey: 'mag_id (BIGSERIAL)',
    foreignKey: 'product_id → data_product(product_id) ON DELETE CASCADE',
    normalization: '3NF / BCNF Normalized',
    attributesCount: 8,
    indexes: [
      { name: 'pk_mag_field', type: 'B-Tree (Unique)', cols: 'mag_id' },
      { name: 'idx_mag_prod_time', type: 'Composite B-Tree', cols: 'product_id, sample_time DESC' },
      { name: 'idx_mag_bz_shock', type: 'B-Tree', cols: 'bz_nt ASC' }
    ],
    checkConstraints: [
      "CHECK (coord_system IN ('GSE', 'GSM'))",
      'CHECK (sampling_rate_hz BETWEEN 1.0 AND 128.0)'
    ],
    querySnippet: `EXPLAIN ANALYZE
SELECT sample_time, bx_nt, by_nt, bz_nt, btotal_nt
FROM mag_field_measurement
WHERE bz_nt < -10.0
ORDER BY sample_time DESC;`
  }
};

export default function PayloadsView({ payloads, initialPayload = 'VELC' }) {
  const [selectedCode, setSelectedCode] = useState(initialPayload);
  const [measurements, setMeasurements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (initialPayload) {
      setSelectedCode(initialPayload);
    }
  }, [initialPayload]);

  // Fetch specialized sub-table measurements
  useEffect(() => {
    setLoading(true);
    fetch(`/api/payloads/${selectedCode}/measurements?limit=25`)
      .then(res => res.json())
      .then(data => {
        setMeasurements(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load measurements:', err);
        setLoading(false);
      });
  }, [selectedCode]);

  const activePayloadMeta = payloads?.find(p => p.payload_code === selectedCode) || {
    payload_code: selectedCode,
    name: 'Selected Payload',
    payload_category: 'REMOTE_SENSING',
    instrument_type: 'Solar Instrument',
    lead_institution: 'ISRO / Partner Institution',
    primary_science_obj: 'Scientific observations at L1.',
    spectral_or_energy_range: 'Multi-wavelength',
    pradan_browse_path: `/al1/${selectedCode.toLowerCase()}/`
  };

  const dbmsInfo = PAYLOAD_DBMS_SCHEMA[selectedCode] || PAYLOAD_DBMS_SCHEMA.VELC;

  const handleCopySql = () => {
    navigator.clipboard.writeText(dbmsInfo.querySnippet);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Payload Selector Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
        {payloads && payloads.map(p => {
          const isSelected = p.payload_code === selectedCode;
          const isRemote = p.payload_category === 'REMOTE_SENSING';
          return (
            <button
              key={p.payload_code}
              onClick={() => setSelectedCode(p.payload_code)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                isSelected
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-glow'
                  : 'bg-space-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{p.payload_code}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                isRemote ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
              }`}>
                {isRemote ? 'REMOTE' : 'IN-SITU'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Payload Information & DBMS Relational Schema Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Payload Metadata & Course Schema Mapping */}
        <div className="lg:col-span-7 platform-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white font-mono">
                  {activePayloadMeta.payload_code}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono border border-sky-500/30">
                  {activePayloadMeta.payload_category}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  {dbmsInfo.normalization}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activePayloadMeta.name}</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              STATUS NOMINAL
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-space-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">INSTRUMENT TYPE</div>
              <div className="text-white font-semibold">{activePayloadMeta.instrument_type}</div>
            </div>
            <div className="bg-space-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">LEAD INSTITUTION</div>
              <div className="text-white font-semibold">{activePayloadMeta.lead_institution}</div>
            </div>
            <div className="bg-space-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">SPECTRAL / ENERGY RANGE</div>
              <div className="text-sky-300 font-semibold">{activePayloadMeta.spectral_or_energy_range}</div>
            </div>
            <div className="bg-space-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">PRADAN BROWSE PATH</div>
              <div className="text-amber-400 font-semibold truncate">{activePayloadMeta.pradan_browse_path}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-space-950/80 border border-slate-800">
            <div className="text-[11px] font-mono text-slate-400 font-semibold mb-1">
              PRIMARY SCIENCE OBJECTIVE &amp; RELATIONAL PURPOSE
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {activePayloadMeta.primary_science_obj} All measurements are normalized into specialized sub-tables linked to parent <code className="text-sky-300 font-mono">data_product(product_id)</code> via foreign keys with cascade constraints.
            </p>
          </div>
        </div>

        {/* Right 5 Cols: DBMS Schema, Indexes & Constraints Inspector */}
        <div className="lg:col-span-5 platform-card rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              RELATIONAL SCHEMA &amp; CONSTRAINTS
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PostgreSQL 15+
            </span>
          </div>

          {/* PK & FK Mapping */}
          <div className="space-y-2 text-xs font-mono">
            <div className="bg-space-950/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                PRIMARY KEY
              </span>
              <span className="text-amber-300 font-bold">{dbmsInfo.primaryKey}</span>
            </div>

            <div className="bg-space-950/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                FOREIGN KEY (FK)
              </span>
              <span className="text-sky-300 font-semibold text-[11px] truncate max-w-[220px]" title={dbmsInfo.foreignKey}>
                {dbmsInfo.foreignKey}
              </span>
            </div>
          </div>

          {/* B-Tree Indexes Card */}
          <div className="bg-space-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[11px] font-mono text-slate-400 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                INDEXES (B-TREE &amp; COMPOSITE)
              </span>
              <span className="text-[10px] text-slate-500">{dbmsInfo.indexes.length} Defined</span>
            </div>
            <div className="space-y-1.5">
              {dbmsInfo.indexes.map(idx => (
                <div key={idx.name} className="flex items-center justify-between text-[11px] font-mono bg-space-900/80 px-2 py-1 rounded border border-slate-800">
                  <span className="text-sky-400 font-semibold">{idx.name}</span>
                  <span className="text-slate-400 text-[10px]">{idx.type} ({idx.cols})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Domain & Check Constraints */}
          <div className="bg-space-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-[11px] font-mono text-slate-400 font-semibold flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              DOMAIN &amp; CHECK CONSTRAINTS
            </div>
            <div className="space-y-1">
              {dbmsInfo.checkConstraints.map((chk, i) => (
                <div key={i} className="text-[10px] font-mono text-emerald-300/90 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/50 truncate">
                  {chk}
                </div>
              ))}
            </div>
          </div>

          {/* Execution Plan Query Snippet */}
          <div className="bg-space-950/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                OPTIMIZED QUERY (EXPLAIN ANALYZE)
              </span>
              <button
                onClick={handleCopySql}
                className="text-slate-400 hover:text-white transition-colors"
                title="Copy SQL snippet"
              >
                {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-sky-300 bg-space-950 p-2 rounded border border-slate-800/80 overflow-x-auto whitespace-pre leading-relaxed max-h-24">
              {dbmsInfo.querySnippet}
            </pre>
          </div>
        </div>
      </div>

      {/* Specialized Database Sub-Table View */}
      <div className="platform-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <Table className="w-4 h-4 text-sky-400" />
              Specialized PostgreSQL Sub-Table: {dbmsInfo.table}
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Normalized relational telemetry samples recorded in DBMS course schema (Foreign Key: product_id)
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {measurements?.rows?.length || 0} Records
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center font-mono text-xs text-sky-400 animate-pulse">
            Querying relational table {dbmsInfo.table}...
          </div>
        ) : measurements && measurements.rows && measurements.rows.length > 0 ? (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-space-950 border-b border-slate-800 text-slate-400 text-[11px]">
                <tr>
                  {measurements.columns.map(col => (
                    <th key={col} className="py-2 px-3 whitespace-nowrap">
                      {col.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {measurements.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    {measurements.columns.map(col => (
                      <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs font-mono text-slate-500">
            No specialized records in this table yet. Click "Poll Now" to ingest rolling window telemetry.
          </div>
        )}
      </div>
    </div>
  );
}
