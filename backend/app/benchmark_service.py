"""
Aditya-L1 DBMS 10,500-Row Index Benchmark Suite
================================================
Compares unindexed Full Sequential Table Scan vs. Composite B-Tree Index Scan
(idx_observation_payload_start on observation(payload_id, start_time, end_time))
and returns precise latency and SQLite query execution plans.
"""

import sqlite3
import time
import random
import datetime
from typing import Dict, Any, List

def run_indexing_benchmark() -> Dict[str, Any]:
    """
    Creates an in-memory 10,500-row dataset across all 7 payloads and measures
    query latency before and after creating the Composite B-Tree Index.
    """
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE observation_bench (
        observation_id INTEGER PRIMARY KEY,
        payload_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        operating_mode TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE data_product_bench (
        product_id INTEGER PRIMARY KEY,
        observation_id INTEGER NOT NULL,
        processing_level TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL
    );
    """)

    # Populate 10,500 synthetic observations
    base_time = datetime.datetime(2026, 1, 1, 0, 0, 0)
    obs_batch = []
    prod_batch = []

    for i in range(1, 10501):
        payload_id = (i % 7) + 1
        t_start = base_time + datetime.timedelta(minutes=i * 10)
        t_end = t_start + datetime.timedelta(minutes=10)
        obs_batch.append((i, payload_id, t_start.isoformat(), t_end.isoformat(), "NORMAL"))
        prod_batch.append((i, i, "L2" if i % 3 == 0 else "L1", 1024 * 1024 * 16))

    cur.executemany("INSERT INTO observation_bench VALUES (?, ?, ?, ?, ?);", obs_batch)
    cur.executemany("INSERT INTO data_product_bench VALUES (?, ?, ?, ?);", prod_batch)
    conn.commit()

    bench_sql = """
    SELECT o.observation_id, dp.processing_level, o.start_time
    FROM observation_bench AS o
    JOIN data_product_bench AS dp ON dp.observation_id = o.observation_id
    WHERE o.payload_id = 1
      AND o.start_time < '2026-03-01T00:00:00'
      AND o.end_time > '2026-01-15T00:00:00'
    ORDER BY o.start_time ASC;
    """

    # 1. Measure without index (Full Table Scan)
    cur.execute(f"EXPLAIN QUERY PLAN {bench_sql}")
    plan_before = [r[3] for r in cur.fetchall()]

    times_before = []
    for _ in range(25):
        t0 = time.perf_counter()
        cur.execute(bench_sql)
        _ = cur.fetchall()
        t1 = time.perf_counter()
        times_before.append((t1 - t0) * 1000)
    latency_no_index = round(sorted(times_before)[len(times_before)//2], 3)

    # 2. Create Composite B-Tree Index
    cur.execute("CREATE INDEX idx_obs_bench_composite ON observation_bench (payload_id, start_time, end_time);")
    cur.execute("CREATE INDEX idx_dp_bench_obs ON data_product_bench (observation_id);")
    conn.commit()

    # 3. Measure with Composite B-Tree Index
    cur.execute(f"EXPLAIN QUERY PLAN {bench_sql}")
    plan_after = [r[3] for r in cur.fetchall()]

    times_after = []
    for _ in range(25):
        t0 = time.perf_counter()
        cur.execute(bench_sql)
        _ = cur.fetchall()
        t1 = time.perf_counter()
        times_after.append((t1 - t0) * 1000)
    latency_with_index = round(sorted(times_after)[len(times_after)//2], 3)

    # Prevent division by zero
    latency_with_index = max(0.05, latency_with_index)
    speedup = round(latency_no_index / latency_with_index, 2)

    conn.close()

    return {
        "dataset_rows": 10500,
        "payload_tested": "VELC (Payload ID = 1)",
        "query_type": "Composite Time-Window Range Join + Ordering",
        "latency_no_index_ms": latency_no_index,
        "latency_with_index_ms": latency_with_index,
        "speedup_factor": speedup,
        "plan_before": plan_before,
        "plan_after": plan_after,
        "historical_postgres_baseline": {
            "seq_scan_ms": 1.816,
            "index_scan_ms": 0.324,
            "speedup": "5.6x"
        }
    }
