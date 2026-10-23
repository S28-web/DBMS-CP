"""
Aditya-L1 SQLite Database Layer
===============================
Provides 21-table normalized relational schema, seed data mirroring
the PostgreSQL course blueprint, and live query execution + EXPLAIN support.
"""

import sqlite3
import time
import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

DB_PATH = Path(__file__).resolve().parent.parent / "aditya_l1.db"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(force: bool = False):
    """Initializes tables and seeds initial data if database doesn't exist or force=True."""
    if force and DB_PATH.exists():
        try:
            DB_PATH.unlink()
        except Exception:
            pass

    conn = get_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS mission (
        mission_id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        agency TEXT NOT NULL DEFAULT 'ISRO',
        launch_date TEXT NOT NULL,
        orbit_insertion_dt TEXT,
        orbit_regime TEXT NOT NULL DEFAULT 'Sun-Earth L1 Halo Orbit',
        data_portal_url TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payload (
        payload_id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL REFERENCES mission(mission_id),
        payload_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        payload_category TEXT NOT NULL CHECK (payload_category IN ('REMOTE_SENSING', 'IN_SITU')),
        instrument_type TEXT NOT NULL,
        lead_institution TEXT NOT NULL,
        primary_science_obj TEXT NOT NULL,
        spectral_or_energy_range TEXT NOT NULL,
        pradan_browse_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS observation (
        observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload_id INTEGER NOT NULL REFERENCES payload(payload_id),
        external_obs_id TEXT NOT NULL UNIQUE,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        time_scale TEXT NOT NULL DEFAULT 'UTC',
        raw_time_string TEXT,
        operating_mode TEXT NOT NULL,
        orbit_number INTEGER,
        pointing_target TEXT DEFAULT 'Sun_Center',
        cadence_seconds REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_product (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_id INTEGER NOT NULL REFERENCES observation(observation_id),
        product_identifier TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        product_type TEXT NOT NULL,
        processing_level TEXT NOT NULL CHECK (processing_level IN ('L0', 'L1', 'L2', 'L3')),
        file_format TEXT NOT NULL DEFAULT 'FITS',
        file_size_bytes INTEGER NOT NULL,
        checksum_sha256 TEXT,
        pradan_download_uri TEXT NOT NULL,
        storage_uri TEXT,
        release_version TEXT NOT NULL DEFAULT 'V1.0',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_metadata (
        metadata_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL UNIQUE REFERENCES data_product(product_id),
        coordinate_system TEXT DEFAULT 'Helioprojective-Cartesian',
        exposure_duration_s REAL,
        spectral_band TEXT,
        filter_wheel_pos TEXT,
        detector_temp_k REAL,
        crval1 REAL,
        crval2 REAL,
        cdelt1 REAL,
        cdelt2 REAL,
        extended_attributes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS measurement (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        sample_time TEXT NOT NULL,
        parameter_code TEXT NOT NULL,
        numeric_value REAL NOT NULL,
        unit TEXT NOT NULL,
        uncertainty REAL,
        quality_flag INTEGER NOT NULL DEFAULT 0,
        spatial_location TEXT
    );

    CREATE TABLE IF NOT EXISTS velc_coronagraph_measurement (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        sample_time TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        heliocentric_fov_r_sun REAL NOT NULL,
        position_angle_deg REAL NOT NULL,
        mean_coronal_radiance REAL NOT NULL,
        linear_polarization_frac REAL,
        cme_leading_edge_r_sun REAL,
        estimated_cme_speed_kms REAL
    );

    CREATE TABLE IF NOT EXISTS suit_imaging_measurement (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        sample_time TEXT NOT NULL,
        nb_or_bb_filter TEXT NOT NULL,
        central_wavelength_nm REAL NOT NULL,
        roi_mode TEXT NOT NULL,
        active_region_noaa TEXT,
        peak_uv_intensity_dn REAL NOT NULL,
        integrated_uv_irradiance REAL
    );

    CREATE TABLE IF NOT EXISTS xray_spectroscopy_measurement (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        sample_time TEXT NOT NULL,
        instrument_code TEXT NOT NULL,
        energy_band_kev TEXT NOT NULL,
        photon_flux_cm2_s REAL NOT NULL,
        goes_equivalent_class TEXT,
        plasma_temp_mk REAL,
        emission_measure_cm3 REAL,
        non_thermal_index REAL
    );

    CREATE TABLE IF NOT EXISTS insitu_particle_measurement (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        sample_time TEXT NOT NULL,
        instrument_code TEXT NOT NULL,
        sub_sensor TEXT NOT NULL,
        particle_species TEXT NOT NULL,
        energy_channel_kev REAL NOT NULL,
        differential_flux REAL NOT NULL,
        bulk_speed_kms REAL,
        number_density_cm3 REAL,
        alpha_proton_ratio REAL,
        anisotropy_index REAL
    );

    CREATE TABLE IF NOT EXISTS mag_field_measurement (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        sample_time TEXT NOT NULL,
        coord_system TEXT NOT NULL DEFAULT 'GSE',
        bx_nt REAL NOT NULL,
        by_nt REAL NOT NULL,
        bz_nt REAL NOT NULL,
        btotal_nt REAL NOT NULL,
        sampling_rate_hz REAL NOT NULL DEFAULT 8.0
    );

    CREATE TABLE IF NOT EXISTS processing_run (
        processing_run_id INTEGER PRIMARY KEY,
        pipeline_name TEXT NOT NULL,
        software_version TEXT NOT NULL,
        target_level TEXT NOT NULL,
        execution_host TEXT NOT NULL,
        configuration_json TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL DEFAULT 'SUCCESS'
    );

    CREATE TABLE IF NOT EXISTS processing_step (
        step_id INTEGER PRIMARY KEY AUTOINCREMENT,
        processing_run_id INTEGER NOT NULL REFERENCES processing_run(processing_run_id),
        step_sequence INTEGER NOT NULL,
        operation_name TEXT NOT NULL,
        algorithm_ref TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        step_status TEXT NOT NULL DEFAULT 'SUCCESS',
        diagnostic_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS product_lineage (
        lineage_id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        output_product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        processing_run_id INTEGER NOT NULL REFERENCES processing_run(processing_run_id),
        derivation_role TEXT NOT NULL DEFAULT 'PRIMARY_INPUT'
    );

    CREATE TABLE IF NOT EXISTS calibration_record (
        cal_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        payload_id INTEGER NOT NULL REFERENCES payload(payload_id),
        cal_file_reference TEXT NOT NULL,
        cal_version TEXT NOT NULL,
        calibration_type TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        validity_start TEXT NOT NULL,
        validity_end TEXT,
        parameters_applied TEXT
    );

    CREATE TABLE IF NOT EXISTS quality_record (
        quality_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL UNIQUE REFERENCES data_product(product_id),
        validation_status TEXT NOT NULL DEFAULT 'PASSED',
        quality_flag_code INTEGER NOT NULL DEFAULT 0,
        completeness_pct REAL NOT NULL DEFAULT 100.0,
        missing_packets_cnt INTEGER NOT NULL DEFAULT 0,
        snr_estimate REAL,
        anomaly_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS ingestion_run (
        ingestion_run_id INTEGER PRIMARY KEY,
        payload_id INTEGER REFERENCES payload(payload_id),
        portal_endpoint TEXT NOT NULL,
        jsf_viewstate_hash TEXT,
        query_window_start TEXT NOT NULL,
        query_window_end TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        rows_discovered INTEGER NOT NULL DEFAULT 0,
        rows_inserted INTEGER NOT NULL DEFAULT 0,
        rows_skipped_dup INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS ingestion_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingestion_run_id INTEGER NOT NULL REFERENCES ingestion_run(ingestion_run_id),
        product_identifier TEXT NOT NULL,
        product_id INTEGER REFERENCES data_product(product_id),
        action_taken TEXT NOT NULL,
        validation_message TEXT,
        logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS solar_event (
        event_id INTEGER PRIMARY KEY,
        event_code TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        severity_class TEXT NOT NULL,
        source_active_reg TEXT,
        heliographic_coord TEXT,
        onset_time TEXT NOT NULL,
        peak_time TEXT,
        end_time TEXT,
        detection_method TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        scientific_summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_product_link (
        link_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL REFERENCES solar_event(event_id),
        product_id INTEGER NOT NULL REFERENCES data_product(product_id),
        evidence_role TEXT NOT NULL,
        time_offset_minutes REAL NOT NULL DEFAULT 0.0,
        correlation_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS cross_payload_analysis (
        analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_title TEXT NOT NULL,
        primary_event_id INTEGER NOT NULL REFERENCES solar_event(event_id),
        remote_payload_ids TEXT,
        insitu_payload_ids TEXT,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        propagation_lag_hrs REAL NOT NULL,
        correlation_method TEXT NOT NULL,
        pearson_r_xray_uv REAL,
        peak_bz_drop_nt REAL,
        findings_summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Indices for B-tree acceleration
    CREATE INDEX IF NOT EXISTS idx_observation_payload_start ON observation (payload_id, start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_data_product_obs_level ON data_product (observation_id, processing_level);
    CREATE INDEX IF NOT EXISTS idx_lineage_input_product ON product_lineage (input_product_id);
    CREATE INDEX IF NOT EXISTS idx_lineage_output_product ON product_lineage (output_product_id);
    CREATE INDEX IF NOT EXISTS idx_ingestion_run_status ON ingestion_run (status, started_at DESC);
    """)

    # Seed data if empty
    cursor.execute("SELECT COUNT(*) FROM mission;")
    if cursor.fetchone()[0] == 0:
        seed_data(cursor)

    conn.commit()
    conn.close()

def seed_data(cursor: sqlite3.Cursor):
    """Populates initial seed records mirroring PostgreSQL blueprint."""
    cursor.execute("""
    INSERT INTO mission (mission_id, mission_code, name, agency, launch_date, orbit_insertion_dt, orbit_regime, data_portal_url, description)
    VALUES (1, 'ADITYA_L1', 'Aditya-L1 Solar Observatory', 'ISRO', '2023-09-02 06:20:00+00', '2024-01-06 10:45:00+00', 'Sun-Earth L1 Halo Orbit', 'https://pradan.issdc.gov.in/al1/', 'Indias premier solar space observatory stationed at Sun-Earth Lagrange point L1 for coronal thermodynamics, space weather, and solar wind dynamics.');
    """)

    cursor.executemany("""
    INSERT INTO payload (payload_id, mission_id, payload_code, name, payload_category, instrument_type, lead_institution, primary_science_obj, spectral_or_energy_range, pradan_browse_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (1, 1, 'VELC', 'Visible Emission Line Coronagraph', 'REMOTE_SENSING', 'Internally Occulted Coronagraph', 'Indian Institute of Astrophysics (IIA), Bengaluru', 'Coronal dynamics, CME initiation, and coronal magnetic field topology.', '500 nm continuum, 530.3 nm [Fe XIV], 1074.7 nm [Fe XIII]', '/al1/velc/'),
        (2, 1, 'SUIT', 'Solar Ultraviolet Imaging Telescope', 'REMOTE_SENSING', 'Full-Disk UV Filtergraph Imager', 'Inter-University Centre for Astronomy and Astrophysics (IUCAA), Pune', 'Photospheric & chromospheric dynamics, UV irradiance variations, solar flare triggers.', '200 - 400 nm (11 narrow-band and broad-band filters)', '/al1/suit/'),
        (3, 1, 'SoLEXS', 'Solar Low Energy X-ray Spectrometer', 'REMOTE_SENSING', 'Silicon Drift Detector X-ray Spectrometer', 'U R Rao Satellite Centre (URSC), Bengaluru', 'High-cadence monitoring of solar flare soft X-ray spectra and coronal plasma temperatures.', '1 - 22 keV with energy resolution < 250 eV at 5.9 keV', '/al1/solexs/'),
        (4, 1, 'HEL1OS', 'High Energy L1 Orbiting X-ray Spectrometer', 'REMOTE_SENSING', 'CZT & CdTe Hard X-ray Spectrometer', 'U R Rao Satellite Centre (URSC), Bengaluru', 'Non-thermal electron acceleration during impulsive solar flare phases.', '10 - 150 keV with fast pulse height processing', '/al1/hel1os/'),
        (5, 1, 'ASPEX', 'Aditya Solar wind Particle Experiment', 'IN_SITU', 'Electrostatic Analyzer & Particle Spectrometer', 'Physical Research Laboratory (PRL), Ahmedabad', 'Solar wind ion composition, proton/alpha ratio, and high-energy solar energetic particles.', 'SWIS: 100 eV - 20 keV/q; STEPS: 20 keV - 5 MeV', '/al1/aspex/'),
        (6, 1, 'PAPA', 'Plasma Analyser Package for Aditya', 'IN_SITU', 'Toroidal Electrostatic Analyzer & Retarding Potential', 'Space Physics Laboratory (SPL / VSSC), Thiruvananthapuram', 'Thermal and suprathermal solar wind electrons, bulk solar wind speed and composition.', 'SWICAR: 0.01 - 25 keV; SWEEP: 10 eV - 3 keV electrons', '/al1/papa/'),
        (7, 1, 'MAG', 'Tri-axial High Precision Digital Magnetometer', 'IN_SITU', 'Dual Fluxgate Magnetometer (Inboard & Outboard Booms)', 'Laboratory for Electro-Optics Systems (LEOS), Bengaluru', 'Interplanetary Magnetic Field (IMF) vectors, shock arrival, and geomagnetic storm drivers.', '+/- 65,000 nT with resolution 0.03 nT (8 Hz / 128 Hz modes)', '/al1/mag/')
    ])

    cursor.executemany("""
    INSERT INTO observation (observation_id, payload_id, external_obs_id, start_time, end_time, time_scale, raw_time_string, operating_mode, orbit_number, pointing_target, cadence_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (101, 1, 'OBS_VELC_20260926_230000', '2026-09-26 23:00:00+00', '2026-09-27 00:00:00+00', 'UTC', '2026-09-26T23:00:00', 'SYNOPTIC_CONTINUUM', 1420, 'Sun_Center', 30.0),
        (201, 1, 'OBS_VELC_20261015_134000', '2026-10-15 13:40:00+00', '2026-10-15 14:30:00+00', 'UTC', '2026-10-15T13:40:00', 'HIGH_CADENCE_CME_CAMPAIGN', 1448, 'Sun_Center', 5.0),
        (202, 2, 'OBS_SUIT_20261015_133000', '2026-10-15 13:30:00+00', '2026-10-15 14:30:00+00', 'UTC', '2026-10-15T13:30:00', 'FLARE_TRIGGER_ROI_FAST', 1448, 'AR_13854', 12.0),
        (203, 3, 'OBS_SOLEXS_20261015_130000', '2026-10-15 13:00:00+00', '2026-10-15 15:00:00+00', 'UTC', '2026-10-15T13:00:00', 'STANDARD_SPECTROSCOPY', 1448, 'Full_Disk_Xray', 1.0),
        (204, 4, 'OBS_HEL1OS_20261015_133000', '2026-10-15 13:30:00+00', '2026-10-15 14:30:00+00', 'UTC', '2026-10-15T13:30:00', 'BURST_TRIGGER_MODE', 1448, 'Full_Disk_HardXray', 0.5),
        (301, 5, 'OBS_ASPEX_20261016_080000', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00', 'SWIS_STEPS_CONTINUOUS', 1450, 'Solar_Wind_Stream', 8.0),
        (302, 6, 'OBS_PAPA_20261016_080000', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00', 'TOROIDAL_SCAN_NORMAL', 1450, 'Solar_Wind_Stream', 2.0),
        (303, 7, 'OBS_MAG_20261016_080000', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', 'UTC', '2026-10-16T08:00:00', 'SCIENCE_BURST_8HZ', 1450, 'Ambient_IMF', 0.125)
    ])

    cursor.executemany("""
    INSERT INTO data_product (product_id, observation_id, product_identifier, filename, product_type, processing_level, file_format, file_size_bytes, checksum_sha256, pradan_download_uri, release_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (1001, 101, 'AL1_VELC_20260926T230012_L0_CONT_V1.0', 'AL1_VELC_20260926T230012_L0_CONT_V1.0.fits', 'CORONAGRAPH_IMAGE', 'L0', 'FITS', 33554432, 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123', 'https://pradan.issdc.gov.in/al1/download?id=1001', 'V1.0'),
        (1002, 101, 'AL1_VELC_20260926T230012_L1_CONT_V1.0', 'AL1_VELC_20260926T230012_L1_CONT_V1.0.fits', 'CORONAGRAPH_IMAGE', 'L1', 'FITS', 33554432, 'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef012345', 'https://pradan.issdc.gov.in/al1/download?id=1002', 'V1.0'),
        (1003, 101, 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0', 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0.fits', 'CORONAGRAPH_IMAGE', 'L2', 'FITS', 16777216, 'c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01234567', 'https://pradan.issdc.gov.in/al1/download?id=1003', 'V1.0'),
        (2001, 201, 'AL1_VELC_20261015T134500_L0_CME_V1.2', 'AL1_VELC_20261015T134500_L0_CME_V1.2.fits', 'CORONAGRAPH_IMAGE', 'L0', 'FITS', 33554432, '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff', 'https://pradan.issdc.gov.in/al1/download?id=2001', 'V1.2'),
        (2002, 201, 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2', 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2.fits', 'CORONAGRAPH_IMAGE', 'L2', 'FITS', 16777216, '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111', 'https://pradan.issdc.gov.in/al1/download?id=2002', 'V1.2'),
        (2003, 202, 'AL1_SUIT_20261015T133500_L0_NB03_V1.1', 'AL1_SUIT_20261015T133500_L0_NB03_V1.1.fits', 'NUV_FULL_DISK', 'L0', 'FITS', 67108864, '33334444555566667777888899990000aaaabbbbccccddddeeeeffff11112222', 'https://pradan.issdc.gov.in/al1/download?id=2003', 'V1.1'),
        (2004, 202, 'AL1_SUIT_20261015T134210_L2_NB03_V1.1', 'AL1_SUIT_20261015T134210_L2_NB03_V1.1.fits', 'NUV_FULL_DISK', 'L2', 'FITS', 67108864, '4444555566667777888899990000aaaabbbbccccddddeeeeffff111122223333', 'https://pradan.issdc.gov.in/al1/download?id=2004', 'V1.1'),
        (2005, 203, 'AL1_SOLEXS_20261015T130000_L0_LC_V1.0', 'AL1_SOLEXS_20261015T130000_L0_LC_V1.0.fits', 'SOFT_XRAY_LC', 'L0', 'FITS', 8388608, '555566667777888899990000aaaabbbbccccddddeeeeffff1111222233334444', 'https://pradan.issdc.gov.in/al1/download?id=2005', 'V1.0'),
        (2006, 203, 'AL1_SOLEXS_20261015T130000_L2_LC_V1.0', 'AL1_SOLEXS_20261015T130000_L2_LC_V1.0.fits', 'SOFT_XRAY_LC', 'L2', 'FITS', 4194304, '66667777888899990000aaaabbbbccccddddeeeeffff11112222333344445555', 'https://pradan.issdc.gov.in/al1/download?id=2006', 'V1.0'),
        (2007, 204, 'AL1_HEL1OS_20261015T133000_L0_HXR_V1.0', 'AL1_HEL1OS_20261015T133000_L0_HXR_V1.0.fits', 'HARD_XRAY_SPEC', 'L0', 'FITS', 12582912, '7777888899990000aaaabbbbccccddddeeeeffff111122223333444455556666', 'https://pradan.issdc.gov.in/al1/download?id=2007', 'V1.0'),
        (2008, 204, 'AL1_HEL1OS_20261015T133500_L2_HXR_V1.0', 'AL1_HEL1OS_20261015T133500_L2_HXR_V1.0.fits', 'HARD_XRAY_SPEC', 'L2', 'FITS', 6291456, '888899990000aaaabbbbccccddddeeeeffff1111222233334444555566667777', 'https://pradan.issdc.gov.in/al1/download?id=2008', 'V1.0'),
        (2009, 301, 'AL1_ASPEX_STEPS_20261015T143000_L2_SEP_V1.0', 'AL1_ASPEX_STEPS_20261015T143000_L2_SEP_V1.0.cdf', 'SW_ION_FLUX', 'L2', 'CDF', 8388608, '99990000aaaabbbbccccddddeeeeffff11112222333344445555666677778888', 'https://pradan.issdc.gov.in/al1/download?id=2009', 'V1.0'),
        (3001, 301, 'AL1_ASPEX_SWIS_20261016T080000_L0_RAW_V1.1', 'AL1_ASPEX_SWIS_20261016T080000_L0_RAW_V1.1.cdf', 'SW_ION_FLUX', 'L0', 'CDF', 25165824, 'aaaa0000111122223333444455556666777788889999bbbbccccddddeeeeffff', 'https://pradan.issdc.gov.in/al1/download?id=3001', 'V1.1'),
        (3002, 301, 'AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1', 'AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1.cdf', 'SW_ION_FLUX', 'L2', 'CDF', 12582912, 'bbbb1111222233334444555566667777888899990000aaaaccccddddeeeeffff', 'https://pradan.issdc.gov.in/al1/download?id=3002', 'V1.1'),
        (3003, 302, 'AL1_PAPA_SWICAR_20261016T080000_L0_RAW_V1.0', 'AL1_PAPA_SWICAR_20261016T080000_L0_RAW_V1.0.cdf', 'PLASMA_ELEC_DIST', 'L0', 'CDF', 18874368, 'cccc222233334444555566667777888899990000aaaabbbbddddeeeeffff1111', 'https://pradan.issdc.gov.in/al1/download?id=3003', 'V1.0'),
        (3004, 302, 'AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0', 'AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0.cdf', 'PLASMA_ELEC_DIST', 'L2', 'CDF', 9437184, 'dddd33334444555566667777888899990000aaaabbbbcccceeeeffff11112222', 'https://pradan.issdc.gov.in/al1/download?id=3004', 'V1.0'),
        (3005, 303, 'AL1_MAG_20261016T080000_L0_TS_V1.2', 'AL1_MAG_20261016T080000_L0_TS_V1.2.nc', 'IMF_VECTOR', 'L0', 'NETCDF', 50331648, 'eeee4444555566667777888899990000aaaabbbbccccddddffff111122223333', 'https://pradan.issdc.gov.in/al1/download?id=3005', 'V1.2'),
        (3006, 303, 'AL1_MAG_20261016T080000_L2_GSE_V1.2', 'AL1_MAG_20261016T080000_L2_GSE_V1.2.nc', 'IMF_VECTOR', 'L2', 'NETCDF', 25165824, 'ffff555566667777888899990000aaaabbbbccccddddeeee1111222233334444', 'https://pradan.issdc.gov.in/al1/download?id=3006', 'V1.2')
    ])

    cursor.executemany("""
    INSERT INTO velc_coronagraph_measurement (product_id, sample_time, channel_type, heliocentric_fov_r_sun, position_angle_deg, mean_coronal_radiance, linear_polarization_frac, cme_leading_edge_r_sun, estimated_cme_speed_kms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (1003, '2026-09-26 23:30:00+00', 'CONTINUUM_500NM', 1.45, 95.0, 4.12e-6, 0.182, None, None),
        (2002, '2026-10-15 14:00:00+00', 'CONTINUUM_500NM', 1.35, 282.0, 1.85e-5, 0.241, 1.35, 1380.0),
        (2002, '2026-10-15 14:12:00+00', 'CONTINUUM_500NM', 2.10, 282.0, 2.40e-5, 0.265, 2.10, 1460.0)
    ])

    cursor.executemany("""
    INSERT INTO suit_imaging_measurement (product_id, sample_time, nb_or_bb_filter, central_wavelength_nm, roi_mode, active_region_noaa, peak_uv_intensity_dn, integrated_uv_irradiance) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (2004, '2026-10-15 13:45:00+00', 'NB03', 279.6, 'FLARE_TRIGGER_ROI', 'NOAA_13854', 58420.0, 14.82),
        (2004, '2026-10-15 13:47:12+00', 'NB03', 279.6, 'FLARE_TRIGGER_ROI', 'NOAA_13854', 64110.0, 18.45)
    ])

    cursor.executemany("""
    INSERT INTO xray_spectroscopy_measurement (product_id, sample_time, instrument_code, energy_band_kev, photon_flux_cm2_s, goes_equivalent_class, plasma_temp_mk, emission_measure_cm3, non_thermal_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (2006, '2026-10-15 13:42:00+00', 'SoLEXS', '1-10_keV', 1.42e5, 'M6.8', 18.4, 3.2e49, None),
        (2006, '2026-10-15 13:48:00+00', 'SoLEXS', '1-10_keV', 4.85e5, 'X2.4', 26.8, 8.9e49, None),
        (2008, '2026-10-15 13:46:30+00', 'HEL1OS', '25-50_keV', 485.2, 'X2.4', 28.1, 7.5e49, 3.45),
        (2008, '2026-10-15 13:47:00+00', 'HEL1OS', '50-100_keV', 92.4, 'X2.4', None, None, 3.60)
    ])

    cursor.executemany("""
    INSERT INTO insitu_particle_measurement (product_id, sample_time, instrument_code, sub_sensor, particle_species, energy_channel_kev, differential_flux, bulk_speed_kms, number_density_cm3, alpha_proton_ratio, anisotropy_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (2009, '2026-10-15 14:35:00+00', 'ASPEX', 'STEPS', 'PROTON_H+', 2000.0, 1280.0, None, None, 0.062, 1.84),
        (3002, '2026-10-16 10:50:00+00', 'ASPEX', 'SWIS', 'PROTON_H+', 1.2, 4.2e6, 410.5, 6.2, 0.041, 0.12),
        (3002, '2026-10-16 11:20:00+00', 'ASPEX', 'SWIS', 'PROTON_H+', 2.45, 3.8e7, 685.4, 28.4, 0.089, 0.45),
        (3004, '2026-10-16 11:20:00+00', 'PAPA', 'SWICAR', 'HEAVY_ION_O6+', 12.0, 1.9e4, 680.2, 0.042, None, 0.29)
    ])

    cursor.executemany("""
    INSERT INTO mag_field_measurement (product_id, sample_time, coord_system, bx_nt, by_nt, bz_nt, btotal_nt, sampling_rate_hz) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (3006, '2026-10-16 10:50:00+00', 'GSE', 3.4, -2.1, 1.8, 4.387, 8.0),
        (3006, '2026-10-16 11:15:00+00', 'GSE', -8.2, 11.4, -18.6, 23.306, 8.0),
        (3006, '2026-10-16 11:20:00+00', 'GSE', -6.5, 11.653, -22.8, 26.417, 8.0),
        (3006, '2026-10-16 12:00:00+00', 'GSE', -4.9, 9.8, -19.4, 22.28, 8.0)
    ])

    cursor.executemany("""
    INSERT INTO processing_run (processing_run_id, pipeline_name, software_version, target_level, execution_host, configuration_json, started_at, finished_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (501, 'VELC_L0_TO_L1_CALIB', 'velc-pipe-2.4.1', 'L1', 'issdc-velc-worker-02', '{"dark_corr": true, "flat_corr": true}', '2026-09-27 00:15:00+00', '2026-09-27 00:18:42+00', 'SUCCESS'),
        (502, 'VELC_L1_TO_L2_CME_DETECT', 'velc-cme-1.8.0', 'L2', 'issdc-velc-worker-02', '{"running_diff_cadence": 2}', '2026-09-27 00:20:00+00', '2026-09-27 00:22:10+00', 'SUCCESS'),
        (503, 'VELC_L1_TO_L2_CME_DETECT', 'velc-cme-1.8.2', 'L2', 'issdc-velc-worker-04', '{"halo_fit": true}', '2026-10-15 16:00:00+00', '2026-10-15 16:04:15+00', 'SUCCESS'),
        (504, 'SUIT_L1_TO_L2_RADIANCE', 'suit-calib-3.1.0', 'L2', 'iucaa-poc-node-01', '{"wcs_align": true}', '2026-10-15 15:30:00+00', '2026-10-15 15:33:50+00', 'SUCCESS'),
        (505, 'SOLEXS_L1_TO_L2_FLUX', 'solexs-spec-1.5.0', 'L2', 'ursc-xray-node-01', '{"pileup_corr": true}', '2026-10-15 16:10:00+00', '2026-10-15 16:11:30+00', 'SUCCESS'),
        (506, 'HEL1OS_L1_TO_L2_SPEC', 'hel1os-pipe-1.3.4', 'L2', 'ursc-xray-node-02', '{"gain_lut": "V4"}', '2026-10-15 15:20:00+00', '2026-10-15 15:23:05+00', 'SUCCESS'),
        (507, 'ASPEX_L1_TO_L2_MOMENTS', 'aspex-swis-2.0.1', 'L2', 'prl-aspex-node-01', '{"pitch_bins": 16}', '2026-10-16 16:20:00+00', '2026-10-16 16:25:12+00', 'SUCCESS'),
        (508, 'PAPA_L1_TO_L2_COMPOSITION', 'papa-pipe-1.4.0', 'L2', 'spl-papa-node-01', '{"tof_calib": "V3"}', '2026-10-16 16:22:00+00', '2026-10-16 16:26:40+00', 'SUCCESS'),
        (509, 'MAG_L1_TO_L2_GRADIOMETER', 'mag-clean-2.2.0', 'L2', 'leos-mag-node-01', '{"despike": true}', '2026-10-16 16:15:00+00', '2026-10-16 16:17:05+00', 'SUCCESS')
    ])

    cursor.executemany("""
    INSERT INTO product_lineage (input_product_id, output_product_id, processing_run_id, derivation_role) VALUES (?, ?, ?, ?);
    """, [
        (1001, 1002, 501, 'PRIMARY_INPUT'),
        (1002, 1003, 502, 'PRIMARY_INPUT'),
        (2001, 2002, 503, 'PRIMARY_INPUT'),
        (2003, 2004, 504, 'PRIMARY_INPUT'),
        (2005, 2006, 505, 'PRIMARY_INPUT'),
        (2007, 2008, 506, 'PRIMARY_INPUT'),
        (3001, 3002, 507, 'PRIMARY_INPUT'),
        (3003, 3004, 508, 'PRIMARY_INPUT'),
        (3005, 3006, 509, 'PRIMARY_INPUT')
    ])

    cursor.executemany("""
    INSERT INTO quality_record (product_id, validation_status, quality_flag_code, completeness_pct, missing_packets_cnt, snr_estimate, anomaly_notes) VALUES (?, ?, ?, ?, ?, ?, ?);
    """, [
        (1001, 'PASSED', 0, 100.0, 0, 42.5, 'Nominal L0 telemetry stream'),
        (1002, 'PASSED', 0, 100.0, 0, 68.2, 'Clean continuum calibration'),
        (1003, 'PASSED', 0, 100.0, 0, 55.0, 'Nominal synoptic coronal map'),
        (2002, 'PASSED', 0, 99.85, 2, 74.1, 'High-contrast halo CME front captured'),
        (2004, 'PASSED_WITH_WARN', 1, 99.4, 5, 88.0, 'Minor core saturation in 12 flare ribbon pixels during X2.4 peak'),
        (2006, 'PASSED', 0, 100.0, 0, 112.4, 'Dead-time corrected during X2.4 flare peak'),
        (2008, 'PASSED', 0, 99.9, 1, 64.8, 'Strong non-thermal hard X-ray burst detected'),
        (3002, 'PASSED', 0, 100.0, 0, 91.0, 'Clear shock jump in proton bulk velocity'),
        (3004, 'PASSED', 0, 99.75, 3, 83.5, 'Enhanced O6+ and He2+ signatures'),
        (3006, 'PASSED', 0, 100.0, 0, 145.0, 'Zero boom interference residual; sharp southward Bz rotation')
    ])

    cursor.executemany("""
    INSERT INTO solar_event (event_id, event_code, event_type, severity_class, source_active_reg, heliographic_coord, onset_time, peak_time, end_time, detection_method, confidence_score, scientific_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (901, 'AL1_EVT_20261015_FLARE_X2.4', 'SOLAR_FLARE', 'X2.4', 'NOAA_13854', 'N14W22', '2026-10-15 13:38:00+00', '2026-10-15 13:48:00+00', '2026-10-15 14:25:00+00', 'SoLEXS + HEL1OS Automated Flux Threshold & SUIT ROI Trigger', 0.992, 'Impulsive X2.4 solar flare in AR 13854 with non-thermal 25-100 keV hard X-ray peak observed by HEL1OS at 13:46:30 UTC, soft X-ray peak observed by SoLEXS at 13:48:00 UTC, and bright Mg II k flare ribbons imaged by SUIT NB03.'),
        (902, 'AL1_EVT_20261015_CME_HALO', 'CORONAL_MASS_EJECTION', 'HALO_CME_1460KMS', 'NOAA_13854', 'N14W22', '2026-10-15 13:55:00+00', '2026-10-15 14:12:00+00', '2026-10-15 15:30:00+00', 'VELC Running-Difference Radial Kinematics Tracker', 0.975, 'Earth-directed halo CME launched concurrently with the X2.4 flare, tracked by VELC from 1.08 to 2.85 R_sun with an apex speed of 1460 km/s along PA 282 deg.'),
        (903, 'AL1_EVT_20261016_ICME_SHOCK', 'ICME_SHOCK_ARRIVAL', 'BZ_SOUTH_22.8NT', 'NOAA_13854', 'L1_HALO', '2026-10-16 11:12:00+00', '2026-10-16 11:20:00+00', '2026-10-16 15:45:00+00', 'Multi-Payload In-Situ Shock & Magnetic Cloud Classifier', 0.985, 'Interplanetary shock arrival at L1 21.5 hours after the VELC halo CME eruption: ASPEX bulk proton speed jumped from 410 to 685 km/s, PAPA proton density rose to 28.6 cm^-3, and MAG recorded 26.4 nT total field with Bz rotating to -22.8 nT.')
    ])

    cursor.executemany("""
    INSERT INTO event_product_link (event_id, product_id, evidence_role, time_offset_minutes, correlation_notes) VALUES (?, ?, ?, ?, ?);
    """, [
        (901, 2006, 'PRIMARY_TRIGGER', 0.0, 'SoLEXS L2 soft X-ray peak flux at 13:48 UTC'),
        (901, 2008, 'PRIMARY_TRIGGER', -1.5, 'HEL1OS L2 hard X-ray burst peaked 90s prior to soft X-ray maximum'),
        (901, 2004, 'CHROMOSPHERIC_FOOTPOINT', -0.8, 'SUIT L2 NB03 resolved double-ribbon separation in AR 13854'),
        (902, 2002, 'CORONAL_PROPAGATION', 17.0, 'VELC L2 kinematics measured 1460 km/s halo CME expansion'),
        (902, 2009, 'L1_PARTICLE_ARRIVAL', 47.0, 'ASPEX STEPS detected prompt 2 MeV solar energetic protons arriving 47m post-flare onset'),
        (903, 3002, 'L1_PARTICLE_ARRIVAL', 1292.0, 'ASPEX SWIS measured shock jump to 685.4 km/s and He2+/H+ enhancement'),
        (903, 3004, 'L1_PARTICLE_ARRIVAL', 1292.0, 'PAPA SWICAR confirmed ICME sheath plasma compression'),
        (903, 3006, 'L1_MAG_SHOCK_SIGNATURE', 1292.0, 'MAG L2 GSE vectors captured sharp IMF compression (26.4 nT) and southward Bz (-22.8 nT)')
    ])

    cursor.executemany("""
    INSERT INTO ingestion_run (ingestion_run_id, payload_id, portal_endpoint, jsf_viewstate_hash, query_window_start, query_window_end, started_at, finished_at, rows_discovered, rows_inserted, rows_skipped_dup, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (701, 1, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069', '2026-09-26 23:00:00+00', '2026-09-27 00:00:00+00', '2026-09-27 01:00:00+00', '2026-09-27 01:00:18+00', 296, 3, 293, 'SUCCESS', None),
        (702, None, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', '2026-10-15 12:00:00+00', '2026-10-15 18:00:00+00', '2026-10-15 18:05:00+00', '2026-10-15 18:05:42+00', 9, 9, 0, 'SUCCESS', None),
        (703, 2, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', None, '2026-10-16 00:00:00+00', '2026-10-16 06:00:00+00', '2026-10-16 06:05:00+00', '2026-10-16 06:05:31+00', 0, 0, 0, 'FAILED', 'javax.faces.application.ViewExpiredException: View /protected/browse.xhtml could not be restored after session timeout'),
        (704, None, 'https://pradan1.issdc.gov.in/al1/protected/browse.xhtml', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', '2026-10-16 08:00:00+00', '2026-10-16 16:00:00+00', '2026-10-16 16:30:00+00', '2026-10-16 16:30:55+00', 12, 10, 2, 'SUCCESS', None)
    ])

    cursor.executemany("""
    INSERT INTO ingestion_log (ingestion_run_id, product_identifier, product_id, action_taken, validation_message) VALUES (?, ?, ?, ?, ?);
    """, [
        (701, 'AL1_VELC_20260926T230012_L0_CONT_V1.0', 1001, 'INSERTED', 'Validated FITS timestamp and ViewState listing row 1/296'),
        (701, 'AL1_VELC_20260926T230012_L1_CONT_V1.0', 1002, 'INSERTED', 'Validated L1 calibrated continuum product'),
        (701, 'AL1_VELC_20260926T230012_L2_CMEMAP_V1.0', 1003, 'INSERTED', 'Validated L2 coronal radiance map'),
        (702, 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2', 2002, 'INSERTED', 'Ingested VELC halo CME kinematics product'),
        (702, 'AL1_SUIT_20261015T134210_L2_NB03_V1.1', 2004, 'INSERTED', 'Ingested SUIT Mg II k flare ROI map'),
        (702, 'AL1_SOLEXS_20261015T130000_L2_LC_V1.0', 2006, 'INSERTED', 'Ingested SoLEXS X2.4 soft X-ray light curve'),
        (702, 'AL1_HEL1OS_20261015T133500_L2_HXR_V1.0', 2008, 'INSERTED', 'Ingested HEL1OS hard X-ray spectrum'),
        (704, 'AL1_ASPEX_SWIS_20261016T080000_L2_MOM_V1.1', 3002, 'INSERTED', 'Ingested ASPEX SWIS L2 solar wind moments'),
        (704, 'AL1_PAPA_SWICAR_20261016T080000_L2_COMP_V1.0', 3004, 'INSERTED', 'Ingested PAPA SWICAR L2 ion composition'),
        (704, 'AL1_MAG_20261016T080000_L2_GSE_V1.2', 3006, 'INSERTED', 'Ingested MAG L2 GSE vector time series'),
        (704, 'AL1_VELC_20261015T135500_L2_CMEKIN_V1.2', 2002, 'SKIPPED_DUPLICATE', 'Duplicate product_identifier blocked by in-memory hash-set')
    ])


def execute_custom_sql(sql: str) -> Dict[str, Any]:
    """Executes a SQL query, measures latency, and retrieves SQLite query plan."""
    conn = get_connection()
    cursor = conn.cursor()
    t0 = time.perf_counter()
    try:
        # Check query plan first if it's a SELECT
        plan = []
        clean_sql = sql.strip().rstrip(";")
        if clean_sql.upper().startswith("SELECT") or clean_sql.upper().startswith("WITH"):
            try:
                plan_cur = conn.cursor()
                plan_cur.execute(f"EXPLAIN QUERY PLAN {clean_sql}")
                for row in plan_cur.fetchall():
                    # id, parent, notused, detail
                    plan.append(row[3])
            except Exception:
                pass

        cursor.execute(clean_sql)
        rows_raw = cursor.fetchall()
        t1 = time.perf_counter()
        duration_ms = round((t1 - t0) * 1000, 3)

        columns = [d[0] for d in cursor.description] if cursor.description else []
        rows = [list(r) for r in rows_raw]

        return {
            "success": True,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "duration_ms": duration_ms,
            "query_plan": plan,
            "error": None
        }
    except Exception as e:
        t1 = time.perf_counter()
        return {
            "success": False,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "duration_ms": round((t1 - t0) * 1000, 3),
            "query_plan": [],
            "error": str(e)
        }
    finally:
        conn.close()


def get_predefined_queries() -> List[Dict[str, Any]]:
    """Returns the catalog of 6 core course project queries Q1-Q6."""
    return [
        {
            "id": "Q1",
            "title": "Query 1: Products Count by Payload (Outer Join & Grouping)",
            "description": "Groups all 7 payloads and counts associated observations and data products across processing levels.",
            "sql": """SELECT
    pl.payload_code,
    pl.name AS payload_name,
    pl.payload_category,
    COUNT(dp.product_id) AS product_count
FROM payload AS pl
LEFT JOIN observation AS o ON o.payload_id = pl.payload_id
LEFT JOIN data_product AS dp ON dp.observation_id = o.observation_id
GROUP BY pl.payload_id, pl.payload_code, pl.name, pl.payload_category
ORDER BY product_count DESC, pl.payload_code ASC;"""
        },
        {
            "id": "Q2",
            "title": "Query 2: Half-Open Time Range Products (Oct 15-17 Campaign)",
            "description": "Retrieves science products captured during the major October 2026 solar eruption window.",
            "sql": """SELECT
    pl.payload_code,
    dp.product_identifier,
    dp.product_type,
    dp.processing_level,
    o.start_time,
    o.end_time
FROM data_product AS dp
JOIN observation AS o ON o.observation_id = dp.observation_id
JOIN payload AS pl ON pl.payload_id = o.payload_id
WHERE o.start_time < '2026-10-17 00:00:00+00'
  AND o.end_time   > '2026-10-15 00:00:00+00'
ORDER BY o.start_time, pl.payload_code;"""
        },
        {
            "id": "Q3",
            "title": "Query 3: Cross-Payload Observation Overlaps (Self-Join)",
            "description": "Finds simultaneous Level-2 observations between distinct remote-sensing and in-situ instruments.",
            "sql": """SELECT
    p1.payload_code AS payload_1,
    d1.product_identifier AS product_1,
    p2.payload_code AS payload_2,
    d2.product_identifier AS product_2,
    MAX(o1.start_time, o2.start_time) AS overlap_start,
    MIN(o1.end_time, o2.end_time) AS overlap_end
FROM data_product AS d1
JOIN observation AS o1 ON o1.observation_id = d1.observation_id
JOIN payload AS p1 ON p1.payload_id = o1.payload_id
JOIN data_product AS d2 ON d1.product_id < d2.product_id
JOIN observation AS o2 ON o2.observation_id = d2.observation_id
JOIN payload AS p2 ON p2.payload_id = o2.payload_id
WHERE p1.payload_id <> p2.payload_id
  AND o1.start_time < o2.end_time
  AND o2.start_time < o1.end_time
  AND d1.processing_level = 'L2'
  AND d2.processing_level = 'L2'
ORDER BY overlap_start, payload_1, payload_2;"""
        },
        {
            "id": "Q4",
            "title": "Query 4: Recursive Pipeline Lineage DAG (L0 -> L1 -> L2)",
            "description": "Traverses the product lineage graph using a Recursive CTE starting from raw Level-0 telemetry.",
            "sql": """WITH RECURSIVE lineage_chain AS (
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
    pipeline_name,
    software_version,
    status
FROM lineage_chain
ORDER BY hop_depth, started_at;"""
        },
        {
            "id": "Q5",
            "title": "Query 5: Failed Ingestion Runs Audit & Anomaly Detection",
            "description": "Monitors ingestion runs that failed (such as JSF ViewExpiredException session resets).",
            "sql": """SELECT
    ir.ingestion_run_id,
    COALESCE(pl.payload_code, 'ALL_PAYLOADS') AS target_payload,
    ir.started_at,
    ir.finished_at,
    ir.status,
    ir.error_message
FROM ingestion_run AS ir
LEFT JOIN payload AS pl ON pl.payload_id = ir.payload_id
WHERE ir.status = 'FAILED'
ORDER BY ir.started_at DESC;"""
        },
        {
            "id": "Q6",
            "title": "Query 6: Multi-Payload Solar Event Proof & Calibration Chain",
            "description": "Correlates solar flares and CME events with evidence products, quality metrics, and calibrations.",
            "sql": """SELECT
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
    qr.completeness_pct
FROM solar_event AS se
JOIN event_product_link AS epl ON epl.event_id = se.event_id
JOIN data_product AS dp ON dp.product_id = epl.product_id
JOIN observation AS o ON o.observation_id = dp.observation_id
JOIN payload AS pl ON pl.payload_id = o.payload_id
LEFT JOIN quality_record AS qr ON qr.product_id = dp.product_id
ORDER BY se.event_id, epl.time_offset_minutes;"""
        }
    ]

# Automatically initialize on module import
init_db()
