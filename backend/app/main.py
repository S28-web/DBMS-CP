"""
Aditya-L1 FastAPI Mission Telemetry & DBMS Engine Server
========================================================
Provides REST APIs, WebSocket streaming, PRADAN JSF ingestion,
and live SQL workbench execution for Aditya-L1 Mission Control.
"""

import asyncio
import datetime
import json
import math
import random
import time
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.app.db import get_connection, execute_custom_sql, get_predefined_queries
from backend.app.pradan_service import poll_pradan_rolling_window, SEEN_IDENTIFIERS
from backend.app.benchmark_service import run_indexing_benchmark

app = FastAPI(
    title="Aditya-L1 Solar Telemetry & Event Monitoring API",
    description="Backend API for ISRO Aditya-L1 Mission Control, ISSDC PRADAN Ingestion, and DBMS Analytics",
    version="2.0.0"
)

# Enable CORS for Vite dev server, file:/// origin, and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_private_network_headers(request, call_next):
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        res = Response()
        res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Methods"] = "*"
        res.headers["Access-Control-Allow-Headers"] = "*"
        res.headers["Access-Control-Allow-Private-Network"] = "true"
        return res
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

class SqlRequest(BaseModel):
    sql: str

@app.get("/api/status")
def get_mission_status() -> Dict[str, Any]:
    """Returns top-level KPIs, payload health, and real-time space weather summary."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM payload;")
    total_payloads = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM observation;")
    total_observations = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM data_product;")
    total_products = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM solar_event;")
    total_events = cur.fetchone()[0]

    cur.execute("SELECT * FROM ingestion_run ORDER BY started_at DESC LIMIT 1;")
    last_run = cur.fetchone()
    last_run_dict = dict(last_run) if last_run else None

    conn.close()

    now = datetime.datetime.now(datetime.timezone.utc)
    return {
        "status": "NOMINAL",
        "mission": "Aditya-L1",
        "orbit_regime": "Sun-Earth L1 Halo Orbit (~1.5M km from Earth)",
        "server_utc": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "total_payloads": total_payloads,
        "active_payloads": 7,
        "total_observations": total_observations,
        "total_products": total_products,
        "solar_events_detected": total_events,
        "seen_hashset_size": len(SEEN_IDENTIFIERS),
        "last_ingestion_run": last_run_dict,
        "space_weather": {
            "solar_wind_speed_kms": 482.5,
            "proton_density_cm3": 8.4,
            "imf_btotal_nt": 6.8,
            "imf_bz_nt": -1.4,
            "kp_index": 2.7,
            "xray_flux_class": "C2.1",
            "geomagnetic_status": "QUIET"
        }
    }

@app.get("/api/poll")
def trigger_poll(hours: int = 1) -> Dict[str, Any]:
    """Triggers an ISSDC PRADAN rolling-window scrape and O(1) deduplication cycle."""
    return poll_pradan_rolling_window(hours=hours)

@app.get("/api/payloads")
def list_payloads() -> List[Dict[str, Any]]:
    """Returns all 7 Aditya-L1 payloads and their current operational summary."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
    SELECT
        pl.payload_id,
        pl.payload_code,
        pl.name,
        pl.payload_category,
        pl.instrument_type,
        pl.lead_institution,
        pl.primary_science_obj,
        pl.spectral_or_energy_range,
        pl.pradan_browse_path,
        COUNT(DISTINCT o.observation_id) AS obs_count,
        COUNT(dp.product_id) AS product_count
    FROM payload AS pl
    LEFT JOIN observation AS o ON o.payload_id = pl.payload_id
    LEFT JOIN data_product AS dp ON dp.observation_id = o.observation_id
    GROUP BY pl.payload_id
    ORDER BY pl.payload_id;
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

@app.get("/api/payloads/{code}/measurements")
def get_payload_measurements(code: str, limit: int = 50) -> Dict[str, Any]:
    """Returns specialized sub-table telemetry for a given instrument."""
    conn = get_connection()
    cur = conn.cursor()
    code_upper = code.upper()

    table_map = {
        "VELC": "velc_coronagraph_measurement",
        "SUIT": "suit_imaging_measurement",
        "SOLEXS": "xray_spectroscopy_measurement",
        "HEL1OS": "xray_spectroscopy_measurement",
        "ASPEX": "insitu_particle_measurement",
        "PAPA": "insitu_particle_measurement",
        "MAG": "mag_field_measurement"
    }

    target_table = table_map.get(code_upper)
    if not target_table:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Payload {code} measurements not found")

    cur.execute(f"SELECT * FROM {target_table} ORDER BY sample_time DESC LIMIT ?;", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    columns = [d[0] for d in cur.description] if cur.description else []
    conn.close()

    return {
        "payload": code_upper,
        "table": target_table,
        "columns": columns,
        "rows": rows
    }

@app.get("/api/events")
def list_solar_events() -> List[Dict[str, Any]]:
    """Returns detected solar flares, CMEs, and shock wave events."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM solar_event ORDER BY onset_time DESC;")
    events = [dict(r) for r in cur.fetchall()]

    # Attach evidence links
    for ev in events:
        cur.execute("""
        SELECT
            epl.link_id,
            epl.evidence_role,
            epl.time_offset_minutes,
            epl.correlation_notes,
            dp.product_identifier,
            dp.processing_level,
            pl.payload_code
        FROM event_product_link AS epl
        JOIN data_product AS dp ON dp.product_id = epl.product_id
        JOIN observation AS o ON o.observation_id = dp.observation_id
        JOIN payload AS pl ON pl.payload_id = o.payload_id
        WHERE epl.event_id = ?
        ORDER BY epl.time_offset_minutes ASC;
        """, (ev["event_id"],))
        ev["evidence_products"] = [dict(r) for r in cur.fetchall()]

    conn.close()
    return events

@app.get("/api/lineage")
def get_lineage_graph() -> Dict[str, Any]:
    """Returns nodes and edges for the L0 -> L1 -> L2 provenance Directed Acyclic Graph."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT
        dp.product_id,
        dp.product_identifier,
        dp.processing_level,
        dp.product_type,
        dp.file_size_bytes,
        pl.payload_code,
        qr.validation_status,
        qr.completeness_pct
    FROM data_product AS dp
    JOIN observation AS o ON o.observation_id = dp.observation_id
    JOIN payload AS pl ON pl.payload_id = o.payload_id
    LEFT JOIN quality_record AS qr ON qr.product_id = dp.product_id;
    """)
    nodes = [dict(r) for r in cur.fetchall()]

    cur.execute("""
    SELECT
        pl.lineage_id,
        pl.input_product_id AS source,
        pl.output_product_id AS target,
        pl.derivation_role,
        pr.pipeline_name,
        pr.software_version
    FROM product_lineage AS pl
    JOIN processing_run AS pr ON pr.processing_run_id = pl.processing_run_id;
    """)
    edges = [dict(r) for r in cur.fetchall()]
    conn.close()

    return {"nodes": nodes, "edges": edges}

@app.get("/api/runs")
def list_ingestion_runs(limit: int = 15) -> List[Dict[str, Any]]:
    """Returns ingestion runs with recent terminal audit logs."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM ingestion_run ORDER BY started_at DESC LIMIT ?;", (limit,))
    runs = [dict(r) for r in cur.fetchall()]

    for r in runs:
        cur.execute("SELECT * FROM ingestion_log WHERE ingestion_run_id = ? ORDER BY log_id ASC LIMIT 20;", (r["ingestion_run_id"],))
        r["logs"] = [dict(l) for l in cur.fetchall()]

    conn.close()
    return runs

@app.get("/api/sql/queries")
def get_queries() -> List[Dict[str, Any]]:
    """Returns catalog of Q1-Q6 course queries."""
    return get_predefined_queries()

@app.post("/api/sql/execute")
def run_sql(req: SqlRequest) -> Dict[str, Any]:
    """Executes arbitrary SQL query and returns rows, execution time, and query plan."""
    return execute_custom_sql(req.sql)

@app.get("/api/benchmark")
def get_benchmark() -> Dict[str, Any]:
    """Runs the 10,500-row SQLite B-Tree indexing benchmark."""
    return run_indexing_benchmark()

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """Streams live Aditya-L1 magnetic field vector and solar wind data every 1.5 seconds."""
    await websocket.accept()
    step = 0
    try:
        while True:
            step += 1
            now = datetime.datetime.now(datetime.timezone.utc)
            # Realistic synthetic variations around nominal L1 solar wind
            bx = round(3.5 * math.sin(step * 0.1) + random.uniform(-0.3, 0.3), 2)
            by = round(-2.0 * math.cos(step * 0.08) + random.uniform(-0.4, 0.4), 2)
            bz = round(-1.5 + 2.5 * math.sin(step * 0.15) + random.uniform(-0.5, 0.5), 2)
            btotal = round(math.sqrt(bx**2 + by**2 + bz**2), 2)

            sw_speed = round(450.0 + 35.0 * math.sin(step * 0.05) + random.uniform(-5, 5), 1)
            sw_density = round(6.5 + 2.0 * math.cos(step * 0.07) + random.uniform(-0.4, 0.4), 2)
            xray_flux = round(1.2e-4 * (1.0 + 0.15 * math.sin(step * 0.2)), 6)

            packet = {
                "timestamp": now.strftime("%H:%M:%S UTC"),
                "step": step,
                "mag": {"bx": bx, "by": by, "bz": bz, "btotal": btotal},
                "solar_wind": {"speed_kms": sw_speed, "density_cm3": sw_density},
                "xray_flux": xray_flux,
                "active_packets_counter": 145020 + step
            }
            await websocket.send_text(json.dumps(packet))
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass

# Optional Static SPA Mounting for unified single-port production run
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API or WS routes
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")

