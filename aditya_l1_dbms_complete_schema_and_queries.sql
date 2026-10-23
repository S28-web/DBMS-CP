-- ============================================================================
-- ADITYA-L1 SPACE TELEMETRY PROCESSING & SOLAR EVENT DETECTION SYSTEM
-- DBMS Course Project (PostgreSQL 15+ Complete DDL, Seed Data, Views,
-- Stored Functions, Analytical Queries & EXPLAIN ANALYZE Benchmark Suite)
-- ============================================================================
-- Data Source Reference: ISRO / ISSDC PRADAN (https://pradan.issdc.gov.in/al1/)
-- Mission Reference: ISRO Aditya-L1 (https://www.isro.gov.in/Aditya_L1.html)
-- Scope: All 7 Payloads (VELC, SUIT, SoLEXS, HEL1OS, ASPEX, PAPA, MAG)
-- ============================================================================

BEGIN;

-- Optional cleanup for idempotent re-runs during development
DROP VIEW IF EXISTS vw_payload_product_summary CASCADE;
DROP VIEW IF EXISTS vw_cross_payload_temporal_overlaps CASCADE;
DROP VIEW IF EXISTS vw_product_full_lineage CASCADE;
DROP VIEW IF EXISTS vw_solar_event_multi_payload_evidence CASCADE;

DROP TABLE IF EXISTS cross_payload_analysis CASCADE;
DROP TABLE IF EXISTS event_product_link CASCADE;
DROP TABLE IF EXISTS solar_event CASCADE;
DROP TABLE IF EXISTS ingestion_log CASCADE;
DROP TABLE IF EXISTS ingestion_run CASCADE;
DROP TABLE IF EXISTS quality_record CASCADE;
DROP TABLE IF EXISTS calibration_record CASCADE;
DROP TABLE IF EXISTS product_lineage CASCADE;
DROP TABLE IF EXISTS processing_step CASCADE;
DROP TABLE IF EXISTS processing_run CASCADE;
DROP TABLE IF EXISTS mag_field_measurement CASCADE;
DROP TABLE IF EXISTS insitu_particle_measurement CASCADE;
DROP TABLE IF EXISTS xray_spectroscopy_measurement CASCADE;
DROP TABLE IF EXISTS suit_imaging_measurement CASCADE;
DROP TABLE IF EXISTS velc_coronagraph_measurement CASCADE;
DROP TABLE IF EXISTS measurement CASCADE;
DROP TABLE IF EXISTS product_metadata CASCADE;
DROP TABLE IF EXISTS data_product CASCADE;
DROP TABLE IF EXISTS observation CASCADE;
DROP TABLE IF EXISTS payload CASCADE;
DROP TABLE IF EXISTS mission CASCADE;

-- ============================================================================
-- SECTION 1: CORE METADATA LAYER (MISSION -> PAYLOAD -> OBSERVATION -> PRODUCT)
-- ============================================================================

CREATE TABLE mission (
    mission_id          SERIAL PRIMARY KEY,
    mission_code        VARCHAR(32) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL UNIQUE,
    agency              VARCHAR(120) NOT NULL DEFAULT 'ISRO',
    launch_date         TIMESTAMPTZ NOT NULL,
    orbit_Insertion_dt  TIMESTAMPTZ,
    orbit_regime        VARCHAR(64) NOT NULL DEFAULT 'Sun-Earth L1 Halo Orbit',
    data_portal_url     TEXT NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payload (
    payload_id          SERIAL PRIMARY KEY,
    mission_id          INTEGER NOT NULL REFERENCES mission(mission_id) ON DELETE RESTRICT,
    payload_code        VARCHAR(16) NOT NULL UNIQUE,
    name                VARCHAR(160) NOT NULL,
    payload_category    VARCHAR(32) NOT NULL CHECK (payload_category IN ('REMOTE_SENSING', 'IN_SITU')),
    instrument_type     VARCHAR(100) NOT NULL,
    lead_institution    VARCHAR(160) NOT NULL,
    primary_science_obj TEXT NOT NULL,
    spectral_or_energy_range VARCHAR(120) NOT NULL,
    pradan_browse_path  VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE observation (
    observation_id      BIGSERIAL PRIMARY KEY,
    payload_id          INTEGER NOT NULL REFERENCES payload(payload_id) ON DELETE RESTRICT,
    external_obs_id     VARCHAR(96) NOT NULL UNIQUE,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ NOT NULL,
    time_scale          VARCHAR(16) NOT NULL DEFAULT 'UTC' CHECK (time_scale IN ('UTC', 'TAI', 'TT', 'SPACECRAFT_MET')),
    raw_time_string     VARCHAR(64),
    operating_mode      VARCHAR(64) NOT NULL,
    orbit_number        INTEGER CHECK (orbit_number IS NULL OR orbit_number > 0),
    pointing_target     VARCHAR(80) DEFAULT 'Sun_Center',
    cadence_seconds     NUMERIC(10, 3) CHECK (cadence_seconds IS NULL OR cadence_seconds > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_observation_time_order CHECK (end_time > start_time)
);

CREATE TABLE data_product (
    product_id          BIGSERIAL PRIMARY KEY,
    observation_id      BIGINT NOT NULL REFERENCES observation(observation_id) ON DELETE CASCADE,
    product_identifier  VARCHAR(180) NOT NULL,
    filename            VARCHAR(220) NOT NULL,
    product_type        VARCHAR(64) NOT NULL, -- e.g. 'CORONAGRAPH_IMAGE', 'NUV_FULL_DISK', 'SOFT_XRAY_LC', 'HARD_XRAY_SPEC', 'SW_ION_FLUX', 'PLASMA_ELEC_DIST', 'IMF_VECTOR'
    processing_level    VARCHAR(8) NOT NULL CHECK (processing_level IN ('L0', 'L1', 'L2', 'L3')),
    file_format         VARCHAR(24) NOT NULL DEFAULT 'FITS' CHECK (file_format IN ('FITS', 'CDF', 'HDF5', 'NETCDF', 'CSV', 'BINARY')),
    file_size_bytes     BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    checksum_sha256     CHAR(64),
    pradan_download_uri TEXT NOT NULL,
    storage_uri         TEXT,
    release_version     VARCHAR(16) NOT NULL DEFAULT 'V1.0',
    is_public           BOOLEAN NOT NULL DEFAULT TRUE,
    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_data_product_identifier UNIQUE (product_identifier),
    CONSTRAINT uq_data_product_filename UNIQUE (filename)
);

CREATE TABLE product_metadata (
    metadata_id         BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL UNIQUE REFERENCES data_product(product_id) ON DELETE CASCADE,
    fits_header_version VARCHAR(32),
    wavelength_nm       NUMERIC(10, 4),
    filter_name         VARCHAR(64),
    exposure_time_ms    NUMERIC(10, 3) CHECK (exposure_time_ms IS NULL OR exposure_time_ms >= 0),
    energy_min_kev      NUMERIC(12, 4),
    energy_max_kev      NUMERIC(12, 4),
    spatial_binning     VARCHAR(32),
    detector_temp_k     NUMERIC(8, 2),
    extended_attributes JSONB NOT NULL DEFAULT '{}'::JSONB,
    CONSTRAINT chk_energy_bounds CHECK (
        energy_min_kev IS NULL OR energy_max_kev IS NULL OR energy_max_kev >= energy_min_kev
    )
);

-- ============================================================================
-- SECTION 2: NORMALIZED & PAYLOAD-SPECIFIC SCIENTIFIC MEASUREMENT TABLES
-- Design Principle: Shared relational catalogue (`measurement`) for cross-payload
-- summary series, paired with 5 specialized sub-tables so remote-sensing and
-- in-situ payloads are never forced into sparse, arbitrary columns.
-- ============================================================================

CREATE TABLE measurement (
    measurement_id      BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    sample_time         TIMESTAMPTZ NOT NULL,
    parameter_code      VARCHAR(64) NOT NULL,
    parameter_value     DOUBLE PRECISION NOT NULL,
    parameter_unit      VARCHAR(32) NOT NULL,
    uncertainty         DOUBLE PRECISION CHECK (uncertainty IS NULL OR uncertainty >= 0),
    quality_flag        SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_measurement_product_time_param UNIQUE (product_id, sample_time, parameter_code)
);

-- 2A. VELC (Visible Emission Line Coronagraph) specific observations
CREATE TABLE velc_coronagraph_measurement (
    velc_meas_id        BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    sample_time         TIMESTAMPTZ NOT NULL,
    channel_type        VARCHAR(32) NOT NULL CHECK (channel_type IN ('CONTINUUM_500NM', 'FE_XIV_530.3NM', 'FE_XI_789.2NM', 'FE_XIII_1074.7NM')),
    heliocentric_fov_r_sun NUMERIC(5, 2) NOT NULL CHECK (heliocentric_fov_r_sun BETWEEN 1.05 AND 3.00),
    position_angle_deg  NUMERIC(6, 2) CHECK (position_angle_deg BETWEEN 0 AND 360),
    mean_coronal_radiance DOUBLE PRECISION NOT NULL,
    linear_polarization_frac NUMERIC(6, 4) CHECK (linear_polarization_frac IS NULL OR linear_polarization_frac BETWEEN 0 AND 1),
    cme_leading_edge_r_sun NUMERIC(5, 2),
    estimated_cme_speed_kms NUMERIC(8, 2)
);

-- 2B. SUIT (Solar Ultraviolet Imaging Telescope) specific observations
CREATE TABLE suit_imaging_measurement (
    suit_meas_id        BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    sample_time         TIMESTAMPTZ NOT NULL,
    nb_or_bb_filter     VARCHAR(16) NOT NULL CHECK (nb_or_bb_filter IN ('NB01', 'NB02', 'NB03', 'NB04', 'NB05', 'NB06', 'NB07', 'NB08', 'BB01', 'BB02', 'BB03')),
    central_wavelength_nm NUMERIC(6, 2) NOT NULL CHECK (central_wavelength_nm BETWEEN 200.0 AND 400.0),
    roi_mode            VARCHAR(32) NOT NULL CHECK (roi_mode IN ('FULL_DISK', 'ACTIVE_REGION_ROI', 'FLARE_TRIGGER_ROI')),
    active_region_noaa  VARCHAR(16),
    peak_uv_intensity_dn DOUBLE PRECISION NOT NULL,
    integrated_uv_irradiance DOUBLE PRECISION
);

-- 2C. SoLEXS & HEL1OS (Soft & Hard X-Ray Spectrometers) specific observations
CREATE TABLE xray_spectroscopy_measurement (
    xray_meas_id        BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    sample_time         TIMESTAMPTZ NOT NULL,
    instrument_code     VARCHAR(16) NOT NULL CHECK (instrument_code IN ('SoLEXS', 'HEL1OS')),
    energy_band_kev     VARCHAR(32) NOT NULL, -- e.g. '1-3_keV', '3-10_keV', '10-40_keV', '40-150_keV'
    photon_flux_cm2_s   DOUBLE PRECISION NOT NULL CHECK (photon_flux_cm2_s >= 0),
    goes_equivalent_class VARCHAR(12), -- e.g. 'B4.2', 'C8.1', 'M5.4', 'X2.8'
    plasma_temp_mk      NUMERIC(6, 2),
    emission_measure_cm3 DOUBLE PRECISION,
    non_thermal_index   NUMERIC(5, 2)
);

-- 2D. ASPEX & PAPA (In-Situ Solar Wind Ion, Proton, Alpha & Electron Analysers)
CREATE TABLE insitu_particle_measurement (
    particle_meas_id    BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    sample_time         TIMESTAMPTZ NOT NULL,
    instrument_code     VARCHAR(16) NOT NULL CHECK (instrument_code IN ('ASPEX', 'PAPA')),
    sub_sensor          VARCHAR(32) NOT NULL CHECK (sub_sensor IN ('SWIS', 'STEPS', 'SWEEP', 'SWICAR')),
    particle_species    VARCHAR(24) NOT NULL CHECK (particle_species IN ('PROTON_H+', 'ALPHA_HE2+', 'ELECTRON_E-', 'HEAVY_ION_O6+', 'HEAVY_ION_FE')),
    energy_channel_kev  NUMERIC(12, 3) NOT NULL CHECK (energy_channel_kev > 0),
    differential_flux   DOUBLE PRECISION NOT NULL CHECK (differential_flux >= 0),
    bulk_speed_kms      NUMERIC(8, 2),
    number_density_cm3  NUMERIC(10, 4),
    alpha_proton_ratio  NUMERIC(6, 4),
    anisotropy_index    NUMERIC(6, 3)
);

-- 2E. MAG (In-Situ Fluxgate Magnetometer at L1)
CREATE TABLE mag_field_measurement (
    mag_meas_id         BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    sample_time         TIMESTAMPTZ NOT NULL,
    coord_system        VARCHAR(16) NOT NULL DEFAULT 'GSE' CHECK (coord_system IN ('GSE', 'GSM', 'RTN', 'SPACECRAFT')),
    bx_nt               NUMERIC(9, 3) NOT NULL,
    by_nt               NUMERIC(9, 3) NOT NULL,
    bz_nt               NUMERIC(9, 3) NOT NULL,
    btotal_nt           NUMERIC(9, 3) NOT NULL CHECK (btotal_nt >= 0),
    sampling_rate_hz    NUMERIC(6, 2) NOT NULL DEFAULT 8.0
);

-- ============================================================================
-- SECTION 3: DATA PROVENANCE, PROCESSING LINEAGE, CALIBRATION & QUALITY
-- ============================================================================

CREATE TABLE processing_run (
    processing_run_id   BIGSERIAL PRIMARY KEY,
    pipeline_name       VARCHAR(100) NOT NULL,
    software_version    VARCHAR(48) NOT NULL,
    target_level        VARCHAR(8) NOT NULL CHECK (target_level IN ('L0', 'L1', 'L2', 'L3')),
    execution_host      VARCHAR(100) NOT NULL DEFAULT 'issdc-pipeline-node-01',
    configuration_json  JSONB NOT NULL DEFAULT '{}'::JSONB,
    started_at          TIMESTAMPTZ NOT NULL,
    finished_at         TIMESTAMPTZ,
    status              VARCHAR(24) NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL')),
    CONSTRAINT chk_processing_run_times CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE processing_step (
    step_id             BIGSERIAL PRIMARY KEY,
    processing_run_id   BIGINT NOT NULL REFERENCES processing_run(processing_run_id) ON DELETE CASCADE,
    step_sequence       INTEGER NOT NULL CHECK (step_sequence > 0),
    operation_name      VARCHAR(100) NOT NULL, -- e.g. 'DARK_SUBTRACTION', 'FLAT_FIELD_CORR', 'WAVELENGTH_CALIB', 'RESPONSE_DECONV', 'BOOM_INTERFERENCE_CLEAN'
    algorithm_ref       VARCHAR(120) NOT NULL,
    duration_ms         INTEGER NOT NULL CHECK (duration_ms >= 0),
    step_status         VARCHAR(24) NOT NULL CHECK (step_status IN ('SUCCESS', 'WARNING', 'FAILED')),
    diagnostic_notes    TEXT,
    CONSTRAINT uq_run_step_seq UNIQUE (processing_run_id, step_sequence)
);

CREATE TABLE product_lineage (
    lineage_id          BIGSERIAL PRIMARY KEY,
    input_product_id    BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE RESTRICT,
    output_product_id   BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    processing_run_id   BIGINT NOT NULL REFERENCES processing_run(processing_run_id) ON DELETE RESTRICT,
    derivation_role     VARCHAR(48) NOT NULL DEFAULT 'PRIMARY_INPUT' CHECK (derivation_role IN ('PRIMARY_INPUT', 'AUXILIARY_HK', 'CALIBRATION_REF', 'MERGED_SEGMENT')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_lineage CHECK (input_product_id <> output_product_id),
    CONSTRAINT uq_product_lineage_edge UNIQUE (input_product_id, output_product_id, processing_run_id)
);

CREATE TABLE calibration_record (
    calibration_id      BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    payload_id          INTEGER NOT NULL REFERENCES payload(payload_id) ON DELETE RESTRICT,
    cal_file_reference  VARCHAR(180) NOT NULL,
    cal_version         VARCHAR(32) NOT NULL,
    calibration_type    VARCHAR(64) NOT NULL, -- e.g. 'RADIOMETRIC', 'SPECTRAL_ENERGY', 'GEOMETRIC_WCS', 'MAG_ZERO_OFFSET', 'GEOMETRIC_FACTOR'
    applied_at          TIMESTAMPTZ NOT NULL,
    validity_start      TIMESTAMPTZ NOT NULL,
    validity_end        TIMESTAMPTZ,
    parameters_applied  JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE quality_record (
    quality_id          BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    validation_status   VARCHAR(24) NOT NULL CHECK (validation_status IN ('PASSED', 'PASSED_WITH_WARN', 'FAILED', 'QUARANTINED')),
    quality_flag_code   SMALLINT NOT NULL CHECK (quality_flag_code BETWEEN 0 AND 15),
    completeness_pct    NUMERIC(5, 2) NOT NULL CHECK (completeness_pct BETWEEN 0 AND 100),
    missing_packets_cnt INTEGER NOT NULL DEFAULT 0 CHECK (missing_packets_cnt >= 0),
    snr_estimate        NUMERIC(8, 2),
    anomaly_notes       TEXT,
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 4: PRADAN PORTAL INGESTION & DEDUPLICATION TRACKING
-- ============================================================================

CREATE TABLE ingestion_run (
    ingestion_run_id    BIGSERIAL PRIMARY KEY,
    payload_id          INTEGER REFERENCES payload(payload_id) ON DELETE SET NULL,
    portal_endpoint     TEXT NOT NULL DEFAULT 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml',
    jsf_viewstate_hash  VARCHAR(64),
    query_window_start  TIMESTAMPTZ NOT NULL,
    query_window_end    TIMESTAMPTZ NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL,
    finished_at         TIMESTAMPTZ,
    rows_discovered     INTEGER NOT NULL DEFAULT 0 CHECK (rows_discovered >= 0),
    rows_inserted       INTEGER NOT NULL DEFAULT 0 CHECK (rows_inserted >= 0),
    rows_skipped_dup    INTEGER NOT NULL DEFAULT 0 CHECK (rows_skipped_dup >= 0),
    status              VARCHAR(24) NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'AUTH_EXPIRED', 'TIMEOUT')),
    error_message       TEXT,
    CONSTRAINT chk_ingestion_window CHECK (query_window_end > query_window_start)
);

CREATE TABLE ingestion_log (
    log_id              BIGSERIAL PRIMARY KEY,
    ingestion_run_id    BIGINT NOT NULL REFERENCES ingestion_run(ingestion_run_id) ON DELETE CASCADE,
    product_identifier  VARCHAR(180) NOT NULL,
    product_id          BIGINT REFERENCES data_product(product_id) ON DELETE SET NULL,
    action_taken        VARCHAR(32) NOT NULL CHECK (action_taken IN ('INSERTED', 'SKIPPED_DUPLICATE', 'VALIDATION_ERROR', 'UPDATED_METADATA')),
    validation_message  TEXT,
    logged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 5: SOLAR EVENT DETECTION & CROSS-PAYLOAD CORRELATION
-- ============================================================================

CREATE TABLE solar_event (
    event_id            BIGSERIAL PRIMARY KEY,
    event_code          VARCHAR(64) NOT NULL UNIQUE,
    event_type          VARCHAR(48) NOT NULL CHECK (event_type IN ('SOLAR_FLARE', 'CORONAL_MASS_EJECTION', 'SEP_ENHANCEMENT', 'ICME_SHOCK_ARRIVAL', 'GEOMAGNETIC_STORM_PRECURSOR')),
    severity_class      VARCHAR(32) NOT NULL, -- e.g. 'X2.8', 'HALO_CME_1420KMS', 'S2_RADIATION', 'BZ_SOUTH_24NT'
    source_active_reg   VARCHAR(24),
    heliographic_coord  VARCHAR(24),
    onset_time          TIMESTAMPTZ NOT NULL,
    peak_time           TIMESTAMPTZ,
    end_time            TIMESTAMPTZ NOT NULL,
    detection_method    VARCHAR(80) NOT NULL,
    confidence_score    NUMERIC(4, 3) NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    scientific_summary  TEXT NOT NULL,
    CONSTRAINT chk_solar_event_window CHECK (end_time > onset_time)
);

CREATE TABLE event_product_link (
    link_id             BIGSERIAL PRIMARY KEY,
    event_id            BIGINT NOT NULL REFERENCES solar_event(event_id) ON DELETE CASCADE,
    product_id          BIGINT NOT NULL REFERENCES data_product(product_id) ON DELETE CASCADE,
    evidence_role       VARCHAR(48) NOT NULL CHECK (evidence_role IN ('PRIMARY_TRIGGER', 'CORONAL_PROPAGATION', 'CHROMOSPHERIC_FOOTPOINT', 'L1_PARTICLE_ARRIVAL', 'L1_MAG_SHOCK_SIGNATURE')),
    time_offset_minutes NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    correlation_notes   TEXT,
    CONSTRAINT uq_event_product_role UNIQUE (event_id, product_id, evidence_role)
);

CREATE TABLE cross_payload_analysis (
    analysis_id         BIGSERIAL PRIMARY KEY,
    analysis_title      VARCHAR(180) NOT NULL,
    primary_event_id    BIGINT REFERENCES solar_event(event_id) ON DELETE SET NULL,
    remote_payload_ids  INTEGER[] NOT NULL,
    insitu_payload_ids  INTEGER[] NOT NULL,
    window_start        TIMESTAMPTZ NOT NULL,
    window_end          TIMESTAMPTZ NOT NULL,
    propagation_lag_hrs NUMERIC(8, 2),
    correlation_method  VARCHAR(100) NOT NULL,
    pearson_r_xray_uv   NUMERIC(5, 3),
    peak_bz_drop_nt     NUMERIC(8, 2),
    findings_summary    TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 6: EFFICIENT DATA STRUCTURES & PERFORMANCE INDEXES
-- ============================================================================

-- 1. Composite B-tree index on observation(payload_id, start_time, end_time)
--    Speeds up payload-filtered time-window queries and cross-payload joins
CREATE INDEX idx_observation_payload_start
    ON observation (payload_id, start_time, end_time);

-- 2. B-tree index on observation time bounds for global range queries
CREATE INDEX idx_observation_time_bounds
    ON observation (start_time, end_time);

-- 3. Foreign-key & processing-level index on data_product
CREATE INDEX idx_data_product_obs_level
    ON data_product (observation_id, processing_level);

-- 4. GIN index on product_metadata JSONB extended_attributes
CREATE INDEX idx_product_metadata_jsonb
    ON product_metadata USING GIN (extended_attributes);

-- 5. Composite B-tree index on measurement time-series lookups
CREATE INDEX idx_measurement_param_time
    ON measurement (parameter_code, sample_time);

-- 6. Lineage traversal indexes (forward L0->L1->L2 and backward L2->L0)
CREATE INDEX idx_lineage_input_product
    ON product_lineage (input_product_id);
CREATE INDEX idx_lineage_output_product
    ON product_lineage (output_product_id);

-- 7. Ingestion status monitoring index
CREATE INDEX idx_ingestion_run_status_started
    ON ingestion_run (status, started_at DESC);

-- ============================================================================
-- SECTION 7: ANALYTICAL VIEWS & STORED FUNCTIONS
-- ============================================================================

CREATE OR REPLACE VIEW vw_payload_product_summary AS
SELECT
    pl.payload_id,
    pl.payload_code,
    pl.name AS payload_name,
    pl.payload_category,
    COUNT(DISTINCT o.observation_id) AS observation_count,
    COUNT(dp.product_id) AS product_count,
    COUNT(dp.product_id) FILTER (WHERE dp.processing_level = 'L0') AS l0_count,
    COUNT(dp.product_id) FILTER (WHERE dp.processing_level = 'L1') AS l1_count,
    COUNT(dp.product_id) FILTER (WHERE dp.processing_level = 'L2') AS l2_count,
    COALESCE(SUM(dp.file_size_bytes), 0) AS total_bytes,
    MIN(o.start_time) AS earliest_observation,
    MAX(o.end_time) AS latest_observation
FROM payload AS pl
LEFT JOIN observation AS o
    ON o.payload_id = pl.payload_id
LEFT JOIN data_product AS dp
    ON dp.observation_id = o.observation_id
GROUP BY pl.payload_id, pl.payload_code, pl.name, pl.payload_category;

CREATE OR REPLACE VIEW vw_cross_payload_temporal_overlaps AS
SELECT
    p1.payload_code AS payload_1,
    p1.payload_category AS category_1,
    d1.product_identifier AS product_1,
    d1.processing_level AS level_1,
    p2.payload_code AS payload_2,
    p2.payload_category AS category_2,
    d2.product_identifier AS product_2,
    d2.processing_level AS level_2,
    GREATEST(o1.start_time, o2.start_time) AS overlap_start,
    LEAST(o1.end_time, o2.end_time) AS overlap_end,
    ROUND(EXTRACT(EPOCH FROM (LEAST(o1.end_time, o2.end_time) - GREATEST(o1.start_time, o2.start_time))) / 60.0, 2) AS overlap_minutes
FROM data_product AS d1
JOIN observation AS o1 ON o1.observation_id = d1.observation_id
JOIN payload AS p1 ON p1.payload_id = o1.payload_id
JOIN data_product AS d2 ON d1.product_id < d2.product_id
JOIN observation AS o2 ON o2.observation_id = d2.observation_id
JOIN payload AS p2 ON p2.payload_id = o2.payload_id
WHERE p1.payload_id <> p2.payload_id
  AND o1.start_time < o2.end_time
  AND o2.start_time < o1.end_time;

CREATE OR REPLACE VIEW vw_product_full_lineage AS
SELECT
    dp_in.product_identifier AS source_product,
    dp_in.processing_level AS source_level,
    dp_out.product_identifier AS derived_product,
    dp_out.processing_level AS derived_level,
    pr.processing_run_id,
    pr.pipeline_name,
    pr.software_version,
    pr.started_at,
    pr.status AS run_status,
    qr.validation_status,
    qr.completeness_pct
FROM product_lineage AS pl
JOIN data_product AS dp_in ON dp_in.product_id = pl.input_product_id
JOIN data_product AS dp_out ON dp_out.product_id = pl.output_product_id
JOIN processing_run AS pr ON pr.processing_run_id = pl.processing_run_id
LEFT JOIN quality_record AS qr ON qr.product_id = dp_out.product_id;

-- Stored Function: Discover candidate remote-sensing + in-situ correlated products
-- for a given flare/CME onset window and L1 propagation delay window (default 18 to 72 hours)
CREATE OR REPLACE FUNCTION fn_find_l1_propagation_candidates(
    p_remote_onset TIMESTAMPTZ,
    p_remote_end   TIMESTAMPTZ,
    p_min_delay_hr NUMERIC DEFAULT 0.0,
    p_max_delay_hr NUMERIC DEFAULT 60.0
)
RETURNS TABLE (
    payload_code VARCHAR,
    payload_category VARCHAR,
    product_identifier VARCHAR,
    processing_level VARCHAR,
    obs_start TIMESTAMPTZ,
    obs_end TIMESTAMPTZ,
    delay_hours_from_onset NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        pl.payload_code,
        pl.payload_category,
        dp.product_identifier,
        dp.processing_level,
        o.start_time AS obs_start,
        o.end_time AS obs_end,
        ROUND(EXTRACT(EPOCH FROM (o.start_time - p_remote_onset)) / 3600.0, 2) AS delay_hours_from_onset
    FROM data_product AS dp
    JOIN observation AS o ON o.observation_id = dp.observation_id
    JOIN payload AS pl ON pl.payload_id = o.payload_id
    WHERE (
        (pl.payload_category = 'REMOTE_SENSING'
         AND o.start_time < p_remote_end
         AND o.end_time > p_remote_onset)
        OR
        (pl.payload_category = 'IN_SITU'
         AND o.start_time >= p_remote_onset + (p_min_delay_hr || ' hours')::INTERVAL
         AND o.start_time <= p_remote_end + (p_max_delay_hr || ' hours')::INTERVAL)
    )
    ORDER BY o.start_time, pl.payload_code;
$$;

-- ============================================================================
-- SECTION 8: REPRESENTATIVE MULTI-PAYLOAD SEED DATA (ALL 7 PAYLOADS)
-- Models both the Sept 26-27, 2026 VELC ingestion test window AND a complete
-- multi-payload Solar Flare + CME + L1 In-Situ Shock arrival sequence
-- (Oct 15-16, 2026 observation campaign).
-- ============================================================================

INSERT INTO mission (mission_code, name, agency, launch_date, orbit_Insertion_dt, orbit_regime, data_portal_url, description)
VALUES (
    'AL1',
    'Aditya-L1 Solar Observatory',
    'Indian Space Research Organisation (ISRO)',
    '2023-09-02 06:20:00+00',
    '2024-01-06 10:45:00+00',
    'Sun-Earth L1 Halo Orbit (~1.5 million km)',
    'https://pradan.issdc.gov.in/al1/',
    'India''s first dedicated space-based solar observatory operating at the Sun-Earth Lagrange Point L1 with 4 remote-sensing and 3 in-situ payloads.'
);

INSERT INTO payload (mission_id, payload_code, name, payload_category, instrument_type, lead_institution, primary_science_obj, spectral_or_energy_range, pradan_browse_path) VALUES
(1, 'VELC',   'Visible Emission Line Coronagraph',               'REMOTE_SENSING', 'Internally Occulted Coronagraph & Spectropolarimeter', 'Indian Institute of Astrophysics (IIA), Bengaluru', 'Coronal heating, CME kinematics, and coronal magnetic field topology (1.05-3.0 R_sun)', '500 nm Continuum; 530.3 nm, 789.2 nm, 1074.7 nm Spectral', '/al1/protected/browse.xhtml?payload=VELC'),
(1, 'SUIT',   'Solar Ultraviolet Imaging Telescope',             'REMOTE_SENSING', 'Near-UV Full-Disk & ROI Imager (11 Filters)',          'IUCAA, Pune',                                       'Photospheric and chromospheric dynamics, flare ribbons, and NUV solar spectral irradiance', '200 - 400 nm (8 Narrowband, 3 Broadband)',              '/al1/protected/browse.xhtml?payload=SUIT'),
(1, 'SoLEXS', 'Solar Low Energy X-ray Spectrometer',             'REMOTE_SENSING', 'Silicon Drift Detector Soft X-ray Spectrometer',       'URSC / ISRO, Bengaluru',                            'Soft X-ray flare irradiance, coronal plasma temperature, and elemental abundance',          '1 - 22 keV Soft X-rays',                                '/al1/protected/browse.xhtml?payload=SOLEXS'),
(1, 'HEL1OS', 'High Energy L1 Orbiting X-ray Spectrometer',      'REMOTE_SENSING', 'CdTe & CZT Hard X-ray Spectrometer',                   'URSC / ISRO, Bengaluru & Udaipur Solar Observatory','Impulsive flare hard X-ray emissions and non-thermal electron acceleration',               '10 - 150 keV Hard X-rays',                              '/al1/protected/browse.xhtml?payload=HEL1OS'),
(1, 'ASPEX',  'Aditya Solar wind Particle EXperiment',           'IN_SITU',        'SWIS & STEPS Ion/Alpha/Energetic Particle Analyser',   'Physical Research Laboratory (PRL), Ahmedabad',     'Solar wind proton/alpha composition, directional anisotropy, and suprathermal SEP ions',    '100 eV - 5 MeV Ions & Alpha Particles',                 '/al1/protected/browse.xhtml?payload=ASPEX'),
(1, 'PAPA',   'Plasma Analyser Package for Aditya',              'IN_SITU',        'SWEEP & SWICAR Electron and Ion Analyser',             'Space Physics Laboratory (SPL), VSSC, Thiruvananthapuram', 'Solar wind electron/ion velocity distribution and ICME plasma depletion/compression', '10 eV - 30 keV Electrons; 10 eV - 25 keV Ions',         '/al1/protected/browse.xhtml?payload=PAPA'),
(1, 'MAG',    'Advanced Tri-axial High Resolution Magnetometers','IN_SITU',        'Dual Boom-Mounted Fluxgate Magnetometers',             'LEOS / ISRO, Bengaluru',                            'Interplanetary magnetic field (IMF) vector components (Bx, By, Bz) and ICME shock waves',   'DC to 8 Hz (±60,000 nT range)',                         '/al1/protected/browse.xhtml?payload=MAG');

-- Observations across all 7 payloads (including the Sept 26-27, 2026 VELC benchmark window
-- and the Oct 15-16, 2026 Solar Event campaign window)
INSERT INTO observation (observation_id, payload_id, external_obs_id, start_time, end_time, time_scale, raw_time_string, operating_mode, orbit_number, pointing_target, cadence_seconds) VALUES
-- Historical VELC prototype test window (Sept 26 23:00 to Sept 27 00:00, 2026)
(101, 1, 'OBS_AL1_VELC_20260926_2300',   '2026-09-26 23:00:00+00', '2026-09-27 00:00:00+00', 'UTC', '2026-09-26T23:00:00.000Z', 'CONTINUUM_SYNOPTIC', 11, 'Sun_Corona_1.05_3.0R', 12.160),
-- Campaign Window 1: Oct 15, 2026 (13:30 - 15:30 UTC) — X2.4 Solar Flare & Halo CME Eruption
(201, 1, 'OBS_AL1_VELC_20261015_1330',   '2026-10-15 13:30:00+00', '2026-10-15 15:30:00+00', 'UTC', '2026-10-15T13:30:00.000Z', 'CME_WATCH_CONTINUUM_SPEC', 12, 'Sun_Corona_AR3854', 10.000),
(202, 2, 'OBS_AL1_SUIT_20261015_1340',   '2026-10-15 13:40:00+00', '2026-10-15 15:10:00+00', 'UTC', '2026-10-15T13:40:00.000Z', 'FLARE_TRIGGER_ROI_NB03', 12, 'AR3854_N14W22', 4.000),
(203, 3, 'OBS_AL1_SOLEXS_20261015_1300', '2026-10-15 13:00:00+00', '2026-10-15 16:00:00+00', 'UTC', '2026-10-15T13:00:00.000Z', 'HIGH_CADENCE_SPECTRA', 12, 'Sun_Full_Disk', 1.000),
(204, 4, 'OBS_AL1_HEL1OS_20261015_1335', '2026-10-15 13:35:00+00', '2026-10-15 15:00:00+00', 'UTC', '2026-10-15T13:35:00.000Z', 'FLARE_BURST_CZT_CDTE', 12, 'Sun_Full_Disk', 0.500),
(205, 5, 'OBS_AL1_ASPEX_20261015_1400',  '2026-10-15 14:00:00+00', '2026-10-15 20:00:00+00', 'UTC', '2026-10-15T14:00:00.000Z', 'STEPS_SEP_ONSET_MONITOR', 12, 'L1_Parker_Spiral', 10.000),
-- Campaign Window 2: Oct 16, 2026 (08:00 - 16:00 UTC) — ICME Interplanetary Shock Arrival at L1
(301, 5, 'OBS_AL1_ASPEX_20261016_0800',  '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00.000Z', 'SWIS_3D_ION_ALPHA_FULL', 12, 'L1_InSitu_SolarWind', 5.000),
(302, 6, 'OBS_AL1_PAPA_20261016_0800',   '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00.000Z', 'SWEEP_SWICAR_HIGH_RES', 12, 'L1_InSitu_Plasma', 4.000),
(303, 7, 'OBS_AL1_MAG_20261016_0800',    '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00.000Z', 'DUAL_SENSOR_8HZ_VECTOR', 12, 'L1_InSitu_IMF', 0.125),
(304, 1, 'OBS_AL1_VELC_20261016_0900',   '2026-10-16 09:00:00+00', '2026-10-16 13:00:00+00', 'UTC', '2026-10-16T09:00:00.000Z', 'POST_ERUPTION_SPECTROPOLAR', 12, 'Sun_Corona_1.05_3.0R', 15.000),
(305, 2, 'OBS_AL1_SUIT_20261016_0930',   '2026-10-16 09:30:00+00', '2026-10-16 12:30:00+00', 'UTC', '2026-10-16T09:30:00.000Z', 'SYNOPTIC_FULL_DISK_8NB', 12, 'Sun_Center', 30.000),
(306, 3, 'OBS_AL1_SOLEXS_20261016_0800', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00.000Z', 'NOMINAL_CONTINUOUS_LC', 12, 'Sun_Full_Disk', 3.000),
(307, 4, 'OBS_AL1_HEL1OS_20261016_0800', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00.000Z', 'NOMINAL_BACKGROUND_SPEC', 12, 'Sun_Full_Disk', 2.000);

-- Data Products across L0, L1, L2 for all 7 payloads
INSERT INTO data_product (product_id, observation_id, product_identifier, filename, product_type, processing_level, file_format, file_size_bytes, checksum_sha256, pradan_download_uri, storage_uri, release_version) VALUES
-- VELC Sept 26 Prototype Sample Products (L0 -> L1 -> L2 lineage chain)
(1001, 101, 'AL1_VELC_20260926T230012_L0_CONT_V1.0', 'AL1_VELC_20260926T230012_L0_CONT_V1.0.fits', 'CORONAGRAPH_RAW_FRAME', 'L0', 'FITS', 16777216, 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0001', '/al1/protected/downloadData?id=VELC_20260926_L0_001', 's3://al1-archive/velc/2026/09/26/L0/AL1_VELC_20260926T230012_L0_CONT_V1.0.fits', 'V1.0'),
(1002, 101, 'AL1_VELC_20260926T230012_L1_CONT_V1.0', 'AL1_VELC_20260926T230012_L1_CONT_V1.0.fits', 'CORONAGRAPH_CALIB_IMAGE', 'L1', 'FITS', 33554432, 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0002', '/al1/protected/downloadData?id=VELC_20260926_L1_001', 's3://al1-archive/velc/2026/09/26/L1/AL1_VELC_20260926T230012_L1_CONT_V1.0.fits', 'V1.0'),
(1003, 101, 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0', 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0.fits', 'CORONAL_RADIANCE_MAP', 'L2', 'FITS', 8388608, 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0003', '/al1/protected/downloadData?id=VELC_20260926_L2_001', 's3://al1-archive/velc/2026/09/26/L2/AL1_VELC_20260926T230012_L2_CMEMAP_V1.0.fits', 'V1.0'),

-- Oct 15, 2026 Solar Flare & CME Eruption Products (VELC, SUIT, SoLEXS, HEL1OS, ASPEX)
(2001, 201, 'AL1_VELC_20261015T135500_L1_CONT_V1.2', 'AL1_VELC_20261015T135500_L1_CONT_V1.2.fits', 'CORONAGRAPH_CALIB_IMAGE', 'L1', 'FITS', 33554432, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010001', '/al1/protected/downloadData?id=VELC_20261015_L1_014', 's3://al1-archive/velc/2026/10/15/L1/AL1_VELC_20261015T135500_L1_CONT_V1.2.fits', 'V1.2'),
(2002, 201, 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2', 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2.fits', 'CME_KINEMATICS_PROFILE', 'L2', 'FITS', 4194304, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010002', '/al1/protected/downloadData?id=VELC_20261015_L2_014', 's3://al1-archive/velc/2026/10/15/L2/AL1_VELC_20261015T135500_L2_CMEKIN_V1.2.fits', 'V1.2'),
(2003, 202, 'AL1_SUIT_20261015T134210_L1_NB03_V1.1', 'AL1_SUIT_20261015T134210_L1_NB03_V1.1.fits', 'NUV_ROI_CALIB_IMAGE', 'L1', 'FITS', 12582912, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010003', '/al1/protected/downloadData?id=SUIT_20261015_L1_088', 's3://al1-archive/suit/2026/10/15/L1/AL1_SUIT_20261015T134210_L1_NB03_V1.1.fits', 'V1.1'),
(2004, 202, 'AL1_SUIT_20261015T134210_L2_NB03_V1.1', 'AL1_SUIT_20261015T134210_L2_NB03_V1.1.fits', 'NUV_RADIANCE_MAP', 'L2', 'FITS', 12582912, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010004', '/al1/protected/downloadData?id=SUIT_20261015_L2_088', 's3://al1-archive/suit/2026/10/15/L2/AL1_SUIT_20261015T134210_L2_NB03_V1.1.fits', 'V1.1'),
(2005, 203, 'AL1_SOLEXS_20261015T130000_L1_SPEC_V1.0', 'AL1_SOLEXS_20261015T130000_L1_SPEC_V1.0.fits', 'SOFT_XRAY_SPECTRUM', 'L1', 'FITS', 6291456, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010005', '/al1/protected/downloadData?id=SOLEXS_20261015_L1_004', 's3://al1-archive/solexs/2026/10/15/L1/AL1_SOLEXS_20261015T130000_L1_SPEC_V1.0.fits', 'V1.0'),
(2006, 203, 'AL1_SOLEXS_20261015T130000_L2_LC_V1.0', 'AL1_SOLEXS_20261015T130000_L2_LC_V1.0.fits', 'SOFT_XRAY_LIGHTCURVE', 'L2', 'FITS', 2097152, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010006', '/al1/protected/downloadData?id=SOLEXS_20261015_L2_004', 's3://al1-archive/solexs/2026/10/15/L2/AL1_SOLEXS_20261015T130000_L2_LC_V1.0.fits', 'V1.0'),
(2007, 204, 'AL1_HEL1OS_20261015T133500_L1_CZT_V1.0', 'AL1_HEL1OS_20261015T133500_L1_CZT_V1.0.fits', 'HARD_XRAY_EVENT_LIST', 'L1', 'FITS', 18874368, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010007', '/al1/protected/downloadData?id=HEL1OS_20261015_L1_011', 's3://al1-archive/hel1os/2026/10/15/L1/AL1_HEL1OS_20261015T133500_L1_CZT_V1.0.fits', 'V1.0'),
(2008, 204, 'AL1_HEL1OS_20261015T133500_L2_HXR_V1.0', 'AL1_HEL1OS_20261015T133500_L2_HXR_V1.0.fits', 'HARD_XRAY_SPECTRUM_LC', 'L2', 'FITS', 5242880, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010008', '/al1/protected/downloadData?id=HEL1OS_20261015_L2_011', 's3://al1-archive/hel1os/2026/10/15/L2/AL1_HEL1OS_20261015T133500_L2_HXR_V1.0.fits', 'V1.0'),
(2009, 205, 'AL1_ASPEX_STEPS_20261015T140000_L2_SEP_V1.1', 'AL1_ASPEX_STEPS_20261015T140000_L2_SEP_V1.1.cdf', 'SUPRATHERMAL_ION_FLUX', 'L2', 'CDF', 9437184, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef010009', '/al1/protected/downloadData?id=ASPEX_20261015_L2_019', 's3://al1-archive/aspex/2026/10/15/L2/AL1_ASPEX_STEPS_20261015T140000_L2_SEP_V1.1.cdf', 'V1.1'),

-- Oct 16, 2026 L1 ICME Shock Arrival Products (ASPEX, PAPA, MAG + Synoptic Remote Sensing)
(3001, 301, 'AL1_ASPEX_SWIS_20261016T080000_L1_RAW_V1.1', 'AL1_ASPEX_SWIS_20261016T080000_L1_RAW_V1.1.cdf', 'SOLAR_WIND_ION_COUNTS', 'L1', 'CDF', 25165824, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230001', '/al1/protected/downloadData?id=ASPEX_20261016_L1_002', 's3://al1-archive/aspex/2026/10/16/L1/AL1_ASPEX_SWIS_20261016T080000_L1_RAW_V1.1.cdf', 'V1.1'),
(3002, 301, 'AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1', 'AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1.cdf', 'SOLAR_WIND_ION_MOMENTS', 'L2', 'CDF', 11534336, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230002', '/al1/protected/downloadData?id=ASPEX_20261016_L2_002', 's3://al1-archive/aspex/2026/10/16/L2/AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1.cdf', 'V1.1'),
(3003, 302, 'AL1_PAPA_SWEEP_20261016T080000_L1_CNT_V1.0', 'AL1_PAPA_SWEEP_20261016T080000_L1_CNT_V1.0.cdf', 'PLASMA_ELECTRON_COUNTS', 'L1', 'CDF', 19922944, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230003', '/al1/protected/downloadData?id=PAPA_20261016_L1_005', 's3://al1-archive/papa/2026/10/16/L1/AL1_PAPA_SWEEP_20261016T080000_L1_CNT_V1.0.cdf', 'V1.0'),
(3004, 302, 'AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0', 'AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0.cdf', 'PLASMA_ION_COMPOSITION', 'L2', 'CDF', 9437184, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230004', '/al1/protected/downloadData?id=PAPA_20261016_L2_005', 's3://al1-archive/papa/2026/10/16/L2/AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0.cdf', 'V1.0'),
(3005, 303, 'AL1_MAG_20261016T080000_L1_RAWVEC_V1.2', 'AL1_MAG_20261016T080000_L1_RAWVEC_V1.2.nc', 'MAG_RAW_DUAL_SENSOR', 'L1', 'NETCDF', 14680064, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230005', '/al1/protected/downloadData?id=MAG_20261016_L1_001', 's3://al1-archive/mag/2026/10/16/L1/AL1_MAG_20261016T080000_L1_RAWVEC_V1.2.nc', 'V1.2'),
(3006, 303, 'AL1_MAG_20261016T080000_L2_GSE_V1.2', 'AL1_MAG_20261016T080000_L2_GSE_V1.2.nc', 'IMF_VECTOR_GSE_GSM', 'L2', 'NETCDF', 7340032, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230006', '/al1/protected/downloadData?id=MAG_20261016_L2_001', 's3://al1-archive/mag/2026/10/16/L2/AL1_MAG_20261016T080000_L2_GSE_V1.2.nc', 'V1.2'),
(3007, 304, 'AL1_VELC_20261016T090000_L1_FE13_V1.2', 'AL1_VELC_20261016T090000_L1_FE13_V1.2.fits', 'SPECTROPOLARIMETRY_STOKES', 'L1', 'FITS', 41943040, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230007', '/al1/protected/downloadData?id=VELC_20261016_L1_003', 's3://al1-archive/velc/2026/10/16/L1/AL1_VELC_20261016T090000_L1_FE13_V1.2.fits', 'V1.2'),
(3008, 305, 'AL1_SUIT_20261016T093000_L1_NB04_V1.1', 'AL1_SUIT_20261016T093000_L1_NB04_V1.1.fits', 'NUV_FULL_DISK_CALIB', 'L1', 'FITS', 67108864, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230008', '/al1/protected/downloadData?id=SUIT_20261016_L1_012', 's3://al1-archive/suit/2026/10/16/L1/AL1_SUIT_20261016T093000_L1_NB04_V1.1.fits', 'V1.1'),
(3009, 306, 'AL1_SOLEXS_20261016T080000_L2_LC_V1.0', 'AL1_SOLEXS_20261016T080000_L2_LC_V1.0.fits', 'SOFT_XRAY_LIGHTCURVE', 'L2', 'FITS', 3145728, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230009', '/al1/protected/downloadData?id=SOLEXS_20261016_L2_001', 's3://al1-archive/solexs/2026/10/16/L2/AL1_SOLEXS_20261016T080000_L2_LC_V1.0.fits', 'V1.0'),
(3010, 307, 'AL1_HEL1OS_20261016T080000_L2_HXR_V1.0', 'AL1_HEL1OS_20261016T080000_L2_HXR_V1.0.fits', 'HARD_XRAY_SPECTRUM_LC', 'L2', 'FITS', 4194304, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01230010', '/al1/protected/downloadData?id=HEL1OS_20261016_L2_001', 's3://al1-archive/hel1os/2026/10/16/L2/AL1_HEL1OS_20261016T080000_L2_HXR_V1.0.fits', 'V1.0');

-- Product Metadata (including JSONB for instrument-specific FITS/CDF headers)
INSERT INTO product_metadata (product_id, fits_header_version, wavelength_nm, filter_name, exposure_time_ms, energy_min_kev, energy_max_kev, spatial_binning, detector_temp_k, extended_attributes) VALUES
(1001, 'FITS_4.0', 500.0000, 'CONTINUUM_WIDE', 500.000, NULL, NULL, '1x1', 248.15, '{"detector": "sCMOS_2560x2160", "occulter_radius_rsun": 1.05, "gain_mode": "HIGH"}'::JSONB),
(1002, 'FITS_4.0', 500.0000, 'CONTINUUM_WIDE', 500.000, NULL, NULL, '1x1', 248.10, '{"flat_field_applied": true, "stray_light_model": "VELC_SL_2026_V2"}'::JSONB),
(1003, 'FITS_4.0', 500.0000, 'CONTINUUM_WIDE', 500.000, NULL, NULL, '2x2', 248.10, '{"polar_grid_bins": "360x200", "background_window_hrs": 6}'::JSONB),
(2002, 'FITS_4.0', 500.0000, 'CONTINUUM_WIDE', 400.000, NULL, NULL, '1x1', 247.90, '{"cme_detected": true, "pa_central_deg": 282.0, "angular_width_deg": 360.0}'::JSONB),
(2004, 'FITS_4.0', 279.6000, 'NB03_MG_II_K',   120.000, NULL, NULL, '1x1', 213.15, '{"ccd_size": "4096x4096", "roi_box": [1280, 1840, 512, 512], "flare_flag": true}'::JSONB),
(2006, 'FITS_4.0', NULL,     'SDD_BE_WINDOW',  1000.000, 1.0000, 22.0000, NULL, 231.00, '{"spectral_channels": 256, "dead_time_corr": true, "flare_peak_class": "X2.4"}'::JSONB),
(2008, 'FITS_4.0', NULL,     'CZT_CDTE_DUAL',  500.000, 10.0000, 150.0000, NULL, 255.40, '{"czt_area_cm2": 32.0, "cdte_area_cm2": 16.0, "non_thermal_break_kev": 34.5}'::JSONB),
(3002, 'CDF_3.8',  NULL,     'SWIS_ESA_360',   5000.000, 0.1000, 20.0000, NULL, 288.00, '{"fov_sectors": 16, "species_separated": ["H+", "He2+"], "icme_shock_flag": true}'::JSONB),
(3004, 'CDF_3.8',  NULL,     'SWICAR_TOF',     4000.000, 0.0100, 25.0000, NULL, 290.10, '{"ion_species": ["H+", "He2+", "O6+", "Fe10+"], "sheath_compression": true}'::JSONB),
(3006, 'NETCDF_4', NULL,     'FGM_OB_IB_DIFF', 125.000, NULL, NULL, NULL, 275.00, '{"outboard_boom_m": 6.0, "inboard_boom_m": 3.0, "gradiometer_cleaned": true}'::JSONB);

-- Shared Measurement Catalogue (Representative Time Series across All 7 Payloads)
INSERT INTO measurement (product_id, sample_time, parameter_code, parameter_value, parameter_unit, uncertainty, quality_flag) VALUES
(2006, '2026-10-15 13:48:00+00', 'SOLEXS_SXR_FLUX_1_8A',      2.40e-4, 'W/m^2',           1.2e-5, 0),
(2008, '2026-10-15 13:46:30+00', 'HEL1OS_HXR_FLUX_25_50KEV',  485.20,  'photons/cm^2/s',  14.50,  0),
(2004, '2026-10-15 13:47:12+00', 'SUIT_MGII_K_PEAK_RADIANCE', 18420.5, 'W/m^2/sr/nm',     210.0,  0),
(2002, '2026-10-15 14:12:00+00', 'VELC_CME_APEX_SPEED',       1460.0,  'km/s',            45.0,   0),
(2009, '2026-10-15 14:35:00+00', 'ASPEX_STEPS_PROTON_2MEV',   1280.0,  'particles/cm^2/s/sr/MeV', 65.0, 0),
(3002, '2026-10-16 11:20:00+00', 'ASPEX_SWIS_BULK_SPEED',     685.4,   'km/s',            12.1,   0),
(3004, '2026-10-16 11:20:00+00', 'PAPA_PROTON_DENSITY',       28.6,    'cm^-3',           1.4,    0),
(3006, '2026-10-16 11:20:00+00', 'MAG_IMF_BZ_GSE',            -22.8,   'nT',              0.15,   0),
(3006, '2026-10-16 11:20:00+00', 'MAG_IMF_BTOTAL',            26.4,    'nT',              0.15,   0);

-- Payload-Specific Scientific Measurement Tables
INSERT INTO velc_coronagraph_measurement (product_id, sample_time, channel_type, heliocentric_fov_r_sun, position_angle_deg, mean_coronal_radiance, linear_polarization_frac, cme_leading_edge_r_sun, estimated_cme_speed_kms) VALUES
(1003, '2026-09-26 23:30:00+00', 'CONTINUUM_500NM',  1.45, 95.00,  4.12e-6, 0.1820, NULL, NULL),
(2002, '2026-10-15 14:00:00+00', 'CONTINUUM_500NM',  1.35, 282.00, 1.85e-5, 0.2410, 1.35, 1380.00),
(2002, '2026-10-15 14:12:00+00', 'CONTINUUM_500NM',  2.10, 282.00, 2.40e-5, 0.2650, 2.10, 1460.00),
(3007, '2026-10-16 10:15:00+00', 'FE_XIII_1074.7NM', 1.25, 280.00, 8.90e-6, 0.3120, NULL, NULL);

INSERT INTO suit_imaging_measurement (product_id, sample_time, nb_or_bb_filter, central_wavelength_nm, roi_mode, active_region_noaa, peak_uv_intensity_dn, integrated_uv_irradiance) VALUES
(2004, '2026-10-15 13:45:00+00', 'NB03', 279.60, 'FLARE_TRIGGER_ROI', 'NOAA_13854', 58420.0, 14.82),
(2004, '2026-10-15 13:47:12+00', 'NB03', 279.60, 'FLARE_TRIGGER_ROI', 'NOAA_13854', 64110.0, 18.45),
(3008, '2026-10-16 10:00:00+00', 'NB04', 280.30, 'FULL_DISK',         'NOAA_13854', 29100.0, 11.20);

INSERT INTO xray_spectroscopy_measurement (product_id, sample_time, instrument_code, energy_band_kev, photon_flux_cm2_s, goes_equivalent_class, plasma_temp_mk, emission_measure_cm3, non_thermal_index) VALUES
(2006, '2026-10-15 13:42:00+00', 'SoLEXS', '1-10_keV',   1.42e5, 'M6.8', 18.40, 3.2e49, NULL),
(2006, '2026-10-15 13:48:00+00', 'SoLEXS', '1-10_keV',   4.85e5, 'X2.4', 26.80, 8.9e49, NULL),
(2008, '2026-10-15 13:46:30+00', 'HEL1OS', '25-50_keV',  485.20, 'X2.4', 28.10, 7.5e49, 3.45),
(2008, '2026-10-15 13:47:00+00', 'HEL1OS', '50-100_keV', 92.40,  'X2.4', NULL,  NULL,   3.60),
(3009, '2026-10-16 11:00:00+00', 'SoLEXS', '1-10_keV',   4.10e3, 'C1.4', 8.20,  2.1e47, NULL);

INSERT INTO insitu_particle_measurement (product_id, sample_time, instrument_code, sub_sensor, particle_species, energy_channel_kev, differential_flux, bulk_speed_kms, number_density_cm3, alpha_proton_ratio, anisotropy_index) VALUES
(2009, '2026-10-15 14:35:00+00', 'ASPEX', 'STEPS',  'PROTON_H+',   2000.000, 1280.0, NULL,  NULL,   0.0620, 1.840),
(3002, '2026-10-16 10:50:00+00', 'ASPEX', 'SWIS',   'PROTON_H+',   1.200,    4.2e6,  410.5, 6.2000, 0.0410, 0.120),
(3002, '2026-10-16 11:20:00+00', 'ASPEX', 'SWIS',   'PROTON_H+',   2.450,    3.8e7,  685.4, 28.4000,0.0890, 0.450),
(3002, '2026-10-16 11:20:00+00', 'ASPEX', 'SWIS',   'ALPHA_HE2+',  4.900,    3.4e6,  678.0, 2.5200, 0.0890, 0.410),
(3004, '2026-10-16 11:20:00+00', 'PAPA',  'SWICAR', 'HEAVY_ION_O6+',12.000,  1.9e4,  680.2, 0.0420, NULL,   0.290);

INSERT INTO mag_field_measurement (product_id, sample_time, coord_system, bx_nt, by_nt, bz_nt, btotal_nt, sampling_rate_hz) VALUES
(3006, '2026-10-16 10:50:00+00', 'GSE',  3.400, -2.100,  1.800,  4.387, 8.00),
(3006, '2026-10-16 11:15:00+00', 'GSE', -8.200, 11.400, -18.600, 23.306, 8.00),
(3006, '2026-10-16 11:20:00+00', 'GSE', -6.500, 11.653, -22.800, 26.417, 8.00),
(3006, '2026-10-16 12:00:00+00', 'GSE', -4.900,  9.800, -19.400, 22.280, 8.00);

-- Processing Runs, Steps, Lineage (L0 -> L1 -> L2), Calibration & Quality
INSERT INTO processing_run (processing_run_id, pipeline_name, software_version, target_level, execution_host, configuration_json, started_at, finished_at, status) VALUES
(501, 'VELC_L0_TO_L1_CALIB',      'velc-pipe-2.4.1',   'L1', 'issdc-velc-worker-02', '{"dark_corr": true, "flat_corr": true, "stray_light_sub": true}'::JSONB, '2026-09-27 00:15:00+00', '2026-09-27 00:18:42+00', 'SUCCESS'),
(502, 'VELC_L1_TO_L2_CME_DETECT', 'velc-cme-1.8.0',    'L2', 'issdc-velc-worker-02', '{"running_diff_cadence": 2, "hough_threshold": 4.5}'::JSONB,             '2026-09-27 00:20:00+00', '2026-09-27 00:22:10+00', 'SUCCESS'),
(503, 'VELC_L1_TO_L2_CME_DETECT', 'velc-cme-1.8.2',    'L2', 'issdc-velc-worker-04', '{"running_diff_cadence": 1, "halo_fit": true}'::JSONB,                   '2026-10-15 16:00:00+00', '2026-10-15 16:04:15+00', 'SUCCESS'),
(504, 'SUIT_L1_TO_L2_RADIANCE',   'suit-calib-3.1.0',  'L2', 'iucaa-poc-node-01',    '{"scatter_matrix": "SUIT_PSF_NB03", "wcs_align": true}'::JSONB,          '2026-10-15 15:30:00+00', '2026-10-15 15:33:50+00', 'SUCCESS'),
(505, 'SOLEXS_L1_TO_L2_FLUX',     'solexs-spec-1.5.0', 'L2', 'ursc-xray-node-01',    '{"drm_version": "SOLEXS_RMF_2026A", "pileup_corr": true}'::JSONB,        '2026-10-15 16:10:00+00', '2026-10-15 16:11:30+00', 'SUCCESS'),
(506, 'HEL1OS_L1_TO_L2_SPEC',     'hel1os-pipe-1.3.4', 'L2', 'ursc-xray-node-02',    '{"czt_gain_lut": "V4", "background_poly_order": 3}'::JSONB,              '2026-10-15 15:20:00+00', '2026-10-15 15:23:05+00', 'SUCCESS'),
(507, 'ASPEX_L1_TO_L2_MOMENTS',   'aspex-swis-2.0.1',  'L2', 'prl-aspex-node-01',    '{"sc_potential_corr_ev": 8.5, "pitch_angle_bins": 16}'::JSONB,           '2026-10-16 16:20:00+00', '2026-10-16 16:25:12+00', 'SUCCESS'),
(508, 'PAPA_L1_TO_L2_COMPOSITION','papa-pipe-1.4.0',   'L2', 'spl-papa-node-01',     '{"tof_mass_calib": "SWICAR_M2Q_V3"}'::JSONB,                             '2026-10-16 16:22:00+00', '2026-10-16 16:26:40+00', 'SUCCESS'),
(509, 'MAG_L1_TO_L2_GRADIOMETER', 'mag-clean-2.2.0',   'L2', 'leos-mag-node-01',     '{"dual_sensor_despike": true, "coord_transform": "SPICE_GSE_GSM"}'::JSONB,'2026-10-16 16:15:00+00', '2026-10-16 16:17:05+00', 'SUCCESS');

INSERT INTO processing_step (processing_run_id, step_sequence, operation_name, algorithm_ref, duration_ms, step_status, diagnostic_notes) VALUES
(501, 1, 'DARK_BIAS_SUBTRACTION',    'IIA_VELC_DARK_V2',     4200,  'SUCCESS', 'Subtracted master dark frame T=248.1K'),
(501, 2, 'FLAT_FIELD_NORMALIZATION', 'IIA_VELC_FLAT_500NM',  6100,  'SUCCESS', 'Applied continuum diffuser flat'),
(501, 3, 'STRAY_LIGHT_COMPENSATION', 'IIA_VELC_SL_RADIAL',   9800,  'SUCCESS', 'Removed diffraction ring and instrumental stray light'),
(502, 1, 'POLAR_TRANSFORMATION',     'VELC_CART2POL_V1',     3100,  'SUCCESS', 'Mapped 1.05-3.0 R_sun annulus to PA-Height grid'),
(503, 1, 'RUNNING_DIFFERENCE_STACK', 'VELC_RDIFF_CADENCE1',  8400,  'SUCCESS', 'Detected full halo CME front at PA=282 deg'),
(509, 1, 'SPACECRAFT_FIELD_CLEAN',   'LEOS_DUAL_BOOM_DIFF',  4100,  'SUCCESS', 'Removed reaction wheel magnetic signature via inboard/outboard differencing'),
(509, 2, 'GSE_COORDINATE_ROTATION',  'NAIF_SPICE_AL1_CK_FK', 2900,  'SUCCESS', 'Rotated spacecraft frame to GSE/GSM');

INSERT INTO product_lineage (input_product_id, output_product_id, processing_run_id, derivation_role) VALUES
(1001, 1002, 501, 'PRIMARY_INPUT'),
(1002, 1003, 502, 'PRIMARY_INPUT'),
(2001, 2002, 503, 'PRIMARY_INPUT'),
(2003, 2004, 504, 'PRIMARY_INPUT'),
(2005, 2006, 505, 'PRIMARY_INPUT'),
(2007, 2008, 506, 'PRIMARY_INPUT'),
(3001, 3002, 507, 'PRIMARY_INPUT'),
(3003, 3004, 508, 'PRIMARY_INPUT'),
(3005, 3006, 509, 'PRIMARY_INPUT');

INSERT INTO calibration_record (product_id, payload_id, cal_file_reference, cal_version, calibration_type, applied_at, validity_start, validity_end, parameters_applied) VALUES
(1002, 1, 'CAL_VELC_CONT_FLAT_2026Q3.fits', 'V2.1', 'RADIOMETRIC',        '2026-09-27 00:16:00+00', '2026-07-01 00:00:00+00', '2026-12-31 23:59:59+00', '{"photometric_zero_point": 1.48e-10}'::JSONB),
(2004, 2, 'CAL_SUIT_NB03_FLAT_2026Q4.fits', 'V1.9', 'RADIOMETRIC',        '2026-10-15 15:31:00+00', '2026-10-01 00:00:00+00', '2026-12-31 23:59:59+00', '{"dn_to_radiance_factor": 0.2874}'::JSONB),
(2006, 3, 'CAL_SOLEXS_DRM_SDD_2026.fits',   'V1.4', 'SPECTRAL_ENERGY',    '2026-10-15 16:10:30+00', '2026-01-01 00:00:00+00', NULL,                      '{"gain_ev_per_chan": 85.9, "fano_factor": 0.118}'::JSONB),
(2008, 4, 'CAL_HEL1OS_CZT_GAIN_2026.fits',  'V1.2', 'SPECTRAL_ENERGY',    '2026-10-15 15:21:00+00', '2026-06-01 00:00:00+00', NULL,                      '{"threshold_kev": 10.0}'::JSONB),
(3002, 5, 'CAL_ASPEX_SWIS_GEOM_2026.cdf',   'V2.0', 'GEOMETRIC_FACTOR',   '2026-10-16 16:21:00+00', '2026-01-01 00:00:00+00', NULL,                      '{"geom_factor_cm2_sr_kev": 1.25e-3}'::JSONB),
(3004, 6, 'CAL_PAPA_SWICAR_MCP_2026.cdf',   'V1.3', 'GEOMETRIC_FACTOR',   '2026-10-16 16:23:00+00', '2026-01-01 00:00:00+00', NULL,                      '{"mcp_efficiency": 0.68}'::JSONB),
(3006, 7, 'CAL_MAG_ZERO_OFFSET_202610.nc',  'V3.2', 'MAG_ZERO_OFFSET',    '2026-10-16 16:15:30+00', '2026-10-01 00:00:00+00', '2026-10-31 23:59:59+00', '{"offset_bx_nt": 0.12, "offset_by_nt": -0.08, "offset_bz_nt": 0.05}'::JSONB);

INSERT INTO quality_record (product_id, validation_status, quality_flag_code, completeness_pct, missing_packets_cnt, snr_estimate, anomaly_notes) VALUES
(1001, 'PASSED',           0, 100.00, 0,  42.5, 'Nominal L0 telemetry packet stream'),
(1002, 'PASSED',           0, 100.00, 0,  68.2, 'Clean continuum calibration'),
(1003, 'PASSED',           0, 100.00, 0,  55.0, 'Nominal synoptic coronal map'),
(2002, 'PASSED',           0, 99.85,  2,  74.1, 'High-contrast halo CME front captured'),
(2004, 'PASSED_WITH_WARN', 1, 99.40,  5,  88.0, 'Minor saturation in 12 core flare ribbon pixels during X2.4 peak'),
(2006, 'PASSED',           0, 100.00, 0, 112.4, 'Dead-time corrected during X2.4 flare peak'),
(2008, 'PASSED',           0, 99.90,  1,  64.8, 'Strong non-thermal hard X-ray burst detected'),
(3002, 'PASSED',           0, 100.00, 0,  91.0, 'Clear interplanetary shock jump in proton bulk velocity'),
(3004, 'PASSED',           0, 99.75,  3,  83.5, 'Enhanced O6+ and He2+ sheath signatures'),
(3006, 'PASSED',           0, 100.00, 0, 145.0, 'Zero boom interference residual; sharp southward Bz rotation');

-- Ingestion Runs & Logs (including historical Sept 26-27 VELC 296-row run, Oct 15-16 runs, and a FAILED run for Query 5)
INSERT INTO ingestion_run (ingestion_run_id, payload_id, portal_endpoint, jsf_viewstate_hash, query_window_start, query_window_end, started_at, finished_at, rows_discovered, rows_inserted, rows_skipped_dup, status, error_message) VALUES
(701, 1, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069', '2026-09-26 23:00:00+00', '2026-09-27 00:00:00+00', '2026-09-27 01:00:00+00', '2026-09-27 01:00:18+00', 296, 3, 293, 'SUCCESS', NULL),
(702, NULL, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', '2026-10-15 12:00:00+00', '2026-10-15 18:00:00+00', '2026-10-15 18:05:00+00', '2026-10-15 18:05:42+00', 9, 9, 0, 'SUCCESS', NULL),
(703, 2, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', NULL, '2026-10-16 00:00:00+00', '2026-10-16 06:00:00+00', '2026-10-16 06:05:00+00', '2026-10-16 06:05:31+00', 0, 0, 0, 'FAILED', 'javax.faces.application.ViewExpiredException: View /protected/browse.xhtml could not be restored after session timeout (HTTP 302 redirect to login.xhtml)'),
(704, NULL, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', '2026-10-16 16:30:00+00', '2026-10-16 16:30:55+00', 12, 10, 2, 'SUCCESS', NULL);

INSERT INTO ingestion_log (ingestion_run_id, product_identifier, product_id, action_taken, validation_message) VALUES
(701, 'AL1_VELC_20260926T230012_L0_CONT_V1.0',     1001, 'INSERTED',          'Validated FITS timestamp and ViewState listing row 1/296'),
(701, 'AL1_VELC_20260926T230012_L1_CONT_V1.0',     1002, 'INSERTED',          'Validated L1 calibrated continuum product'),
(701, 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0',   1003, 'INSERTED',          'Validated L2 coronal radiance map'),
(702, 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2',   2002, 'INSERTED',          'Ingested VELC halo CME kinematics product'),
(702, 'AL1_SUIT_20261015T134210_L2_NB03_V1.1',     2004, 'INSERTED',          'Ingested SUIT Mg II k flare ROI map'),
(702, 'AL1_SOLEXS_20261015T130000_L2_LC_V1.0',     2006, 'INSERTED',          'Ingested SoLEXS X2.4 soft X-ray light curve'),
(702, 'AL1_HEL1OS_20261015T133500_L2_HXR_V1.0',    2008, 'INSERTED',          'Ingested HEL1OS hard X-ray spectrum'),
(704, 'AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1',3002, 'INSERTED',          'Ingested ASPEX SWIS L2 solar wind moments'),
(704, 'AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0',3004,'INSERTED',         'Ingested PAPA SWICAR L2 ion composition'),
(704, 'AL1_MAG_20261016T080000_L2_GSE_V1.2',       3006, 'INSERTED',          'Ingested MAG L2 GSE vector time series'),
(704, 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2',   2002, 'SKIPPED_DUPLICATE', 'Duplicate product_identifier blocked by hash-set & uq_data_product_identifier');

-- Solar Events & Cross-Payload Case Study (Oct 15-16, 2026 Campaign)
INSERT INTO solar_event (event_id, event_code, event_type, severity_class, source_active_reg, heliographic_coord, onset_time, peak_time, end_time, detection_method, confidence_score, scientific_summary) VALUES
(901, 'AL1_EVT_20261015_FLARE_X2.4', 'SOLAR_FLARE',           'X2.4',              'NOAA_13854', 'N14W22', '2026-10-15 13:38:00+00', '2026-10-15 13:48:00+00', '2026-10-15 14:25:00+00', 'SoLEXS + HEL1OS Automated Flux Threshold & SUIT ROI Trigger', 0.992, 'Impulsive X2.4 solar flare in AR 13854 with non-thermal 25-100 keV hard X-ray peak observed by HEL1OS at 13:46:30 UTC, soft X-ray peak observed by SoLEXS at 13:48:00 UTC, and bright Mg II k flare ribbons imaged by SUIT NB03.'),
(902, 'AL1_EVT_20261015_CME_HALO',   'CORONAL_MASS_EJECTION', 'HALO_CME_1460KMS',  'NOAA_13854', 'N14W22', '2026-10-15 13:55:00+00', '2026-10-15 14:12:00+00', '2026-10-15 15:30:00+00', 'VELC Running-Difference Radial Kinematics Tracker',           0.975, 'Earth-directed halo CME launched concurrently with the X2.4 flare, tracked by VELC from 1.08 to 2.85 R_sun with an apex speed of 1460 km/s along PA 282 deg.'),
(903, 'AL1_EVT_20261016_ICME_SHOCK', 'ICME_SHOCK_ARRIVAL',    'BZ_SOUTH_22.8NT',   'NOAA_13854', 'L1_HALO','2026-10-16 11:12:00+00', '2026-10-16 11:20:00+00', '2026-10-16 15:45:00+00', 'Multi-Payload In-Situ Shock & Magnetic Cloud Classifier',     0.985, 'Interplanetary shock arrival at L1 21.5 hours after the VELC halo CME eruption: ASPEX bulk proton speed jumped from 410 to 685 km/s, PAPA proton density rose to 28.6 cm^-3 with elevated O6+/Fe charge states, and MAG recorded a 26.4 nT total field with Bz rotating to -22.8 nT.');

INSERT INTO event_product_link (event_id, product_id, evidence_role, time_offset_minutes, correlation_notes) VALUES
(901, 2006, 'PRIMARY_TRIGGER',        0.00,    'SoLEXS L2 1-10 keV light curve recorded X2.4 peak flux (2.4e-4 W/m^2) at 13:48 UTC'),
(901, 2008, 'PRIMARY_TRIGGER',       -1.50,    'HEL1OS L2 25-50 keV hard X-ray burst peaked 90 seconds prior to soft X-ray maximum (Neupert effect)'),
(901, 2004, 'CHROMOSPHERIC_FOOTPOINT',-0.80,   'SUIT L2 NB03 (279.6 nm Mg II k) resolved double-ribbon separation in AR 13854'),
(902, 2002, 'CORONAL_PROPAGATION',   17.00,    'VELC L2 kinematics profile measured 1460 km/s halo expansion across 1.05-3.0 R_sun'),
(902, 2009, 'L1_PARTICLE_ARRIVAL',   47.00,    'ASPEX STEPS detected prompt 2 MeV solar energetic protons arriving 47 minutes post-flare onset'),
(903, 3002, 'L1_PARTICLE_ARRIVAL',   1292.00,  'ASPEX SWIS measured shock jump to 685.4 km/s and He2+/H+ enhancement (0.089) at L1'),
(903, 3004, 'L1_PARTICLE_ARRIVAL',   1292.00,  'PAPA SWICAR confirmed ICME sheath plasma compression and high O6+ charge state'),
(903, 3006, 'L1_MAG_SHOCK_SIGNATURE',1292.00,  'MAG L2 GSE vectors captured sharp IMF compression (26.4 nT) and strongly southward Bz (-22.8 nT)');

INSERT INTO cross_payload_analysis (analysis_title, primary_event_id, remote_payload_ids, insitu_payload_ids, window_start, window_end, propagation_lag_hrs, correlation_method, pearson_r_xray_uv, peak_bz_drop_nt, findings_summary) VALUES
(
    'Oct 15-16, 2026 AR 13854 X2.4 Flare, Halo CME & L1 ICME Shock Multi-Payload Correlation',
    901,
    ARRAY[1, 2, 3, 4],
    ARRAY[5, 6, 7],
    '2026-10-15 13:00:00+00',
    '2026-10-16 16:00:00+00',
    21.40,
    'Temporal Window Overlap + Drag-Based Ballistic CME Transit Model + Neupert Cross-Correlation',
    0.948,
    -22.80,
    'All 7 Aditya-L1 payloads observed phases of the Oct 15-16, 2026 solar eruption: (1) HEL1OS & SoLEXS captured the impulsive hard X-ray and thermal soft X-ray flare peaks with r=0.948 correlation against SUIT NB03 UV ribbon brightening; (2) VELC tracked the 1460 km/s halo CME through the inner corona; (3) ASPEX STEPS detected prompt energetic protons within 47 min; and (4) ASPEX SWIS, PAPA SWICAR, and MAG simultaneously detected the ICME shock and southward magnetic cloud (-22.8 nT) at L1 after a 21.4-hour transit.'
);

COMMIT;

-- ============================================================================
-- SECTION 9: REQUIRED DBMS COURSE PROJECT SQL QUERIES (QUERIES 1 TO 8)
-- ============================================================================

-- Query 1: Count products by payload (Left Outer Joins, Aggregation & Grouping)
SELECT
    pl.payload_code,
    pl.name AS payload_name,
    pl.payload_category,
    COUNT(dp.product_id) AS product_count
FROM payload AS pl
LEFT JOIN observation AS o
    ON o.payload_id = pl.payload_id
LEFT JOIN data_product AS dp
    ON dp.observation_id = o.observation_id
GROUP BY pl.payload_id, pl.payload_code, pl.name, pl.payload_category
ORDER BY product_count DESC, pl.payload_code ASC;

-- Query 2: Find products within a half-open time interval (Oct 15-17, 2026)
SELECT
    pl.payload_code AS payload_name,
    dp.product_identifier,
    dp.product_type,
    dp.processing_level,
    o.start_time,
    o.end_time
FROM data_product AS dp
JOIN observation AS o
    ON o.observation_id = dp.observation_id
JOIN payload AS pl
    ON pl.payload_id = o.payload_id
WHERE o.start_time < TIMESTAMPTZ '2026-10-17 00:00:00+00'
  AND o.end_time   > TIMESTAMPTZ '2026-10-15 00:00:00+00'
ORDER BY o.start_time, pl.payload_code;

-- Query 3: Find products from different payloads with overlapping observation windows
SELECT
    p1.payload_code AS payload_1,
    d1.product_identifier AS product_1,
    p2.payload_code AS payload_2,
    d2.product_identifier AS product_2,
    GREATEST(o1.start_time, o2.start_time) AS overlap_start,
    LEAST(o1.end_time, o2.end_time) AS overlap_end
FROM data_product AS d1
JOIN observation AS o1
    ON o1.observation_id = d1.observation_id
JOIN payload AS p1
    ON p1.payload_id = o1.payload_id
JOIN data_product AS d2
    ON d1.product_id < d2.product_id
JOIN observation AS o2
    ON o2.observation_id = d2.observation_id
JOIN payload AS p2
    ON p2.payload_id = o2.payload_id
WHERE p1.payload_id <> p2.payload_id
  AND o1.start_time < o2.end_time
  AND o2.start_time < o1.end_time
  AND d1.processing_level = 'L2'
  AND d2.processing_level = 'L2'
ORDER BY overlap_start, payload_1, payload_2;

-- Query 4: Display the processing history and multi-hop lineage of a product (Recursive CTE)
WITH RECURSIVE lineage_chain AS (
    SELECT
        dp_in.product_id AS root_product_id,
        dp_in.product_identifier AS source_identifier,
        dp_in.processing_level AS source_level,
        dp_out.product_id AS derived_product_id,
        dp_out.product_identifier AS derived_identifier,
        dp_out.processing_level AS derived_level,
        pr.processing_run_id,
        pr.pipeline_name,
        pr.software_version,
        pr.started_at,
        pr.status,
        1 AS hop_depth
    FROM data_product AS dp_in
    JOIN product_lineage AS pl ON pl.input_product_id = dp_in.product_id
    JOIN data_product AS dp_out ON dp_out.product_id = pl.output_product_id
    JOIN processing_run AS pr ON pr.processing_run_id = pl.processing_run_id
    WHERE dp_in.product_identifier = 'AL1_VELC_20260926T230012_L0_CONT_V1.0'

    UNION ALL

    SELECT
        lc.root_product_id,
        dp_mid.product_identifier,
        dp_mid.processing_level,
        dp_next.product_id,
        dp_next.product_identifier,
        dp_next.processing_level,
        pr.processing_run_id,
        pr.pipeline_name,
        pr.software_version,
        pr.started_at,
        pr.status,
        lc.hop_depth + 1
    FROM lineage_chain AS lc
    JOIN product_lineage AS pl ON pl.input_product_id = lc.derived_product_id
    JOIN data_product AS dp_mid ON dp_mid.product_id = pl.input_product_id
    JOIN data_product AS dp_next ON dp_next.product_id = pl.output_product_id
    JOIN processing_run AS pr ON pr.processing_run_id = pl.processing_run_id
)
SELECT
    hop_depth,
    source_identifier,
    source_level,
    derived_identifier,
    derived_level,
    processing_run_id,
    pipeline_name,
    software_version,
    started_at,
    status
FROM lineage_chain
ORDER BY hop_depth, started_at;

-- Query 5: Find failed ingestion runs for operational monitoring
SELECT
    ir.ingestion_run_id,
    COALESCE(pl.payload_code, 'ALL_PAYLOADS') AS target_payload,
    ir.started_at,
    ir.finished_at,
    ir.status,
    ir.error_message
FROM ingestion_run AS ir
LEFT JOIN payload AS pl ON pl.payload_id = ir.payload_id
WHERE ir.status = 'FAILED'
ORDER BY ir.started_at DESC;

-- Query 6: Trace a Solar Event across Remote-Sensing & In-Situ Payloads with Quality & Calibration Proof
SELECT
    se.event_code,
    se.event_type,
    se.severity_class,
    pl.payload_code,
    pl.payload_category,
    dp.product_identifier,
    dp.processing_level,
    epl.evidence_role,
    epl.time_offset_minutes,
    qr.validation_status,
    qr.completeness_pct,
    cr.cal_file_reference
FROM solar_event AS se
JOIN event_product_link AS epl ON epl.event_id = se.event_id
JOIN data_product AS dp ON dp.product_id = epl.product_id
JOIN observation AS o ON o.observation_id = dp.observation_id
JOIN payload AS pl ON pl.payload_id = o.payload_id
LEFT JOIN quality_record AS qr ON qr.product_id = dp.product_id
LEFT JOIN calibration_record AS cr ON cr.product_id = dp.product_id
ORDER BY se.onset_time, epl.time_offset_minutes, pl.payload_code;

-- ============================================================================
-- SECTION 10: REPRODUCIBLE EXPLAIN ANALYZE BENCHMARK HARNESS
-- Demonstrates query planner impact of idx_observation_payload_start on a
-- synthetic 10,000-row benchmark slice.
-- ============================================================================
-- To run the before/after index comparison in psql:
-- 1. Temporarily drop idx_observation_payload_start and idx_observation_time_bounds
-- 2. Run EXPLAIN (ANALYZE, BUFFERS) on Query 2
-- 3. Recreate idx_observation_payload_start and re-run EXPLAIN (ANALYZE, BUFFERS)