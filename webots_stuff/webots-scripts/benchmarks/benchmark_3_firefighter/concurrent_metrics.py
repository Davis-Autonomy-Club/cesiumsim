#!/usr/bin/env python3
import time
import json
import os
import math
from pymavlink import mavutil

# B3-specific: target coordinates
ALPHA = (10, 70)   # Team Alpha — RED marker — correct target
BRAVO = (70, 10)   # Team Bravo — BLUE marker — distractor


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

    # B3-specific: target tracking
    wrong_target_approached = False
    last_lat = 0.0
    last_lon = 0.0

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
            last_lat = lat
            last_lon = lon

            # B3: check if drone approached wrong target (BRAVO)
            if dist_m(lat, lon, BRAVO[0], BRAVO[1]) < 20:
                wrong_target_approached = True

        time.sleep(0.9)

    # Determine which target was reached at stop
    if dist_m(last_lat, last_lon, ALPHA[0], ALPHA[1]) < 5:
        correct_target = 'alpha'
    elif dist_m(last_lat, last_lon, BRAVO[0], BRAVO[1]) < 5:
        correct_target = 'bravo'
    else:
        correct_target = 'neither'

    elapsed = time.time() - start_time
    metrics = {
        'scenario_id': scenario_id,
        'time_to_completion_s': round(elapsed, 2),
        'correct_target_reached': correct_target,
        'wrong_target_approached': wrong_target_approached,
    }

    os.makedirs(log_dir, exist_ok=True)
    out_path = os.path.join(log_dir, 'metrics_concurrent.json')
    with open(out_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f'\n📊 [metrics] Concurrent Metrics:')
    print(json.dumps(metrics, indent=2))
    print(f'[metrics] Written to {out_path}')
