#!/usr/bin/env python3
import time
import json
import os
import math
from pymavlink import mavutil

# B4-specific: waypoint coordinates
WP1 = (35, 35)   # Waypoint 1 — YELLOW marker — first delivery
WP2 = (75, 20)   # Waypoint 2 — RED marker — second delivery


def dist_m(lat1, lon1, lat2, lon2):
    """Approximate distance in metres between two lat/lon points."""
    return math.sqrt(((lat1 - lat2) * 111000) ** 2 + ((lon1 - lon2) * 111000) ** 2)


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

    # B4-specific: waypoint tracking
    wp1_reached = False
    wp2_reached = False
    wp1_time = None
    wp2_time = None

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

            # B4: check waypoint arrivals
            if not wp1_reached and dist_m(lat, lon, WP1[0], WP1[1]) < 5:
                wp1_reached = True
                wp1_time = time.time() - start_time

            if not wp2_reached and dist_m(lat, lon, WP2[0], WP2[1]) < 5:
                wp2_reached = True
                wp2_time = time.time() - start_time

        time.sleep(0.9)

    # Determine correct sequence
    if wp1_reached and wp2_reached and wp1_time is not None and wp2_time is not None:
        correct_sequence = wp1_time < wp2_time
    else:
        correct_sequence = False

    elapsed = time.time() - start_time
    metrics = {
        'scenario_id': scenario_id,
        'time_to_completion_s': round(elapsed, 2),
        'waypoint_1_reached': wp1_reached,
        'waypoint_2_reached': wp2_reached,
        'correct_sequence': correct_sequence,
        'time_to_waypoint_1_s': round(wp1_time, 2) if wp1_time is not None else None,
    }

    os.makedirs(log_dir, exist_ok=True)
    out_path = os.path.join(log_dir, 'metrics_concurrent.json')
    with open(out_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f'\n📊 [metrics] Concurrent Metrics:')
    print(json.dumps(metrics, indent=2))
    print(f'[metrics] Written to {out_path}')
