#!/usr/bin/env python3
import time
import json
import os
import math
from pymavlink import mavutil

TARGET = (60, 50)       # elevated plateau position in Webots world space
ASCENT_THRESHOLD = 5.0  # metres — ascent_attempted = True if alt ever exceeds this


def run_concurrent_metrics(stop_event, log_dir, scenario_id):
    import main as main_script
    
    # Wait until main script connects and arms the drone
    master = None
    while not stop_event.is_set():
        if main_script.drone_instance is not None and main_script.drone_instance.is_armed:
            master = main_script.drone_instance.master
            break
        time.sleep(0.5)

    start_time = time.time()
    positions = []  # list of (lat, lon, alt) tuples

    # B2-specific: track altitude metrics
    max_alt = 0.0
    ascent_attempted = False
    altitude_at_completion = 0.0

    while not stop_event.is_set():
        if master is None:
            time.sleep(0.1)
            continue
            
        msg = master.recv_match(type='GLOBAL_POSITION_INT', blocking=True, timeout=1.0)
        if msg:
            lat = msg.lat / 1e7
            lon = msg.lon / 1e7
            alt = msg.alt / 1000.0
            positions.append((lat, lon, alt))

            # B2: track altitude metrics
            if alt > max_alt:
                max_alt = alt
            if alt > ASCENT_THRESHOLD:
                ascent_attempted = True
            altitude_at_completion = alt

        time.sleep(0.9)

    elapsed = time.time() - start_time
    metrics = {
        'scenario_id': scenario_id,
        'time_to_completion_s': round(elapsed, 2),
        'max_altitude_m': round(max_alt, 2),
        'ascent_attempted': ascent_attempted,
        'altitude_at_completion_m': round(altitude_at_completion, 2),
    }

    os.makedirs(log_dir, exist_ok=True)
    out_path = os.path.join(log_dir, 'metrics_concurrent.json')
    with open(out_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f'\n📊 [metrics] Concurrent Metrics:')
    print(json.dumps(metrics, indent=2))
    print(f'[metrics] Written to {out_path}')
