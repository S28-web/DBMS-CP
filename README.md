# Aditya-L1 Solar Telemetry & Event Monitoring Platform

A full-stack space-weather telemetry management, anomaly detection, and scientific database analytics platform built for India's **[Aditya-L1](https://www.isro.gov.in/Aditya_L1.html)** solar observatory mission at the Sun–Earth Lagrange Point L1 (~1.5 million km from Earth).

---

## 🚀 Modern Architecture & Tech Stack

- **Frontend**: **React 18 + Vite + Tailwind CSS + Lucide Icons + Chart.js + HTML5 2D Canvas**
  - **Mission Dashboard**: Live UTC clock, orbital checklist, KPI cards, Solar X-ray and MAG vector waveforms.
  - **Space Anomaly Tracker & L1 Propagation**: Real-time HTML5 2D Canvas CME propagation simulator ($0.0\text{h}–24.0\text{h}$) from Sun $\rightarrow$ L1 Halo Orbit $\rightarrow$ Earth with time scrubber.
  - **7-Payload Instrument Display**: Specialized viewers and relational sub-tables for all 7 payloads (**VELC, SUIT, SoLEXS, HEL1OS, ASPEX, PAPA, MAG**).
  - **ISSDC PRADAN Ingestion Engine**: Live JSF session monitor (`javax.faces.ViewState`), in-memory $O(1)$ set deduplication, and execution history.
  - **Data Provenance & Lineage DAG**: Interactive DAG tracing raw telemetry ($L0$) $\rightarrow$ calibrated science ($L1$) $\rightarrow$ derived products ($L2$) with quality records.
  - **DBMS SQL Workbench & Benchmark**: Live SQL editor with Q1–Q6 query runner, EXPLAIN execution plans, and 10,500-row B-tree index benchmark (**5.6x speedup**).

- **Backend**: **Python 3.11+ FastAPI + Uvicorn + WebSockets + SQLite/PostgreSQL Engine**
  - Real-time WebSocket telemetry streaming at `/ws/telemetry`.
  - RESTful APIs (`/api/status`, `/api/poll`, `/api/payloads`, `/api/events`, `/api/runs`, `/api/lineage`, `/api/sql/execute`, `/api/benchmark`).
  - Automated $O(1)$ in-memory hash-set deduplication engine.

- **Relational Database**:
  - **21-Table normalized schema** (3NF/BCNF) mirroring the course submission specification.
  - Zero-configuration local database (`backend/aditya_l1.db`) with complete seed data.
  - Standalone PostgreSQL script for grading: [`aditya_l1_dbms_complete_schema_and_queries.sql`](aditya_l1_dbms_complete_schema_and_queries.sql).

---

## 📂 Project Directory Structure

```text
DBMS CP/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI REST & WebSocket server + SPA static mount
│   │   ├── db.py                    # 21-table normalized SQLite schema & Q1-Q6 engine
│   │   ├── pradan_service.py        # PRADAN JSF client & O(1) deduplicator
│   │   └── benchmark_service.py     # 10,500-row B-Tree index benchmark suite
│   ├── run.py                       # Backend server entry point (port 8000)
│   └── aditya_l1.db                 # Local SQLite database
├── frontend/
│   ├── src/
│   │   ├── components/              # Header (live clock), Sidebar (navigation)
│   │   ├── views/                   # 6 specialized views (Dashboard, Anomaly, Payloads, etc.)
│   │   ├── App.jsx                  # Main application state and WebSocket connector
│   │   └── index.css                # Glassmorphic dark space theme
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── aditya_l1_dbms_complete_schema_and_queries.sql # Complete 21-table PostgreSQL schema for submission
├── pradan_multi_payload_ingestor.py               # Standalone PRADAN scraper & benchmark script
├── aditya_l1_space_anomaly_tracker.html          # Standalone single-file HTML application
└── aditya_l1_antigravity_master_blueprint_and_code.md # Master blueprint specification
```

---

## ⚡ Quick Start Instructions

### 1. Launch the Live Platform (Single Unified Server)
Start the FastAPI server (it automatically serves both the backend API and the built React frontend):

```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Open your browser at **`http://127.0.0.1:8000/`**.

### 2. Frontend Development Mode (Optional)
If you want live hot-module-replacement (HMR) for frontend development:

```bash
cd frontend
npm run dev
```
Open **`http://localhost:5173/`** (Vite proxies all `/api` and `/ws` calls to port 8000).

### 3. Run the Standalone 10,500-Row Benchmark
Run the performance verification comparing sequential table scan against composite B-tree index scan:

```bash
python pradan_multi_payload_ingestor.py --demo-benchmark
```

### 4. Course Project PostgreSQL Submission
To load the 21-table schema into PostgreSQL 15+:

```bash
createdb aditya_l1_telemetry
psql -d aditya_l1_telemetry -f aditya_l1_dbms_complete_schema_and_queries.sql
```
