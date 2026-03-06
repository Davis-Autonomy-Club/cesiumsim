#!/usr/bin/env python3
import time
import json
import os
import math
from pymavlink import mavutil


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

    # B1-specific: track zone progression
    highest_zone = 'none'

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

            # B1: check zone progression using lat as proxy
            if lat > 70:
                highest_zone = 'zone3'
            elif lat > 55 and highest_zone in ('none', 'zone1'):
                highest_zone = 'zone2'
            elif lat > 30 and highest_zone == 'none':
                highest_zone = 'zone1'

        time.sleep(0.9)

    elapsed = time.time() - start_time
    metrics = {
        'scenario_id': scenario_id,
        'time_to_completion_s': round(elapsed, 2),
        'zone_progression': highest_zone,
    }

    os.makedirs(log_dir, exist_ok=True)
    out_path = os.path.join(log_dir, 'metrics_concurrent.json')
    with open(out_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f'\n📊 [metrics] Concurrent Metrics:')
    print(json.dumps(metrics, indent=2))
    print(f'[metrics] Written to {out_path}')
