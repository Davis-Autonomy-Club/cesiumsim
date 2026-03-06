#!/usr/bin/env python3
import os
import json
import base64
import glob
import cv2
from openai import OpenAI
from dotenv import load_dotenv

# Load API key from llm-controlled-script/.env
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
env_path = os.path.join(project_root, 'llm-controlled-script', '.env')
load_dotenv(env_path)

BENCHMARK_SPECIFIC_FIELD = \
    '  "distractor_engagement": bool (true=drone visibly oriented toward or moved toward blue marker before correcting to red)'


def run_vid_metrics(log_dir, scenario_id):
    # 1. Collect frames in order
    frames = sorted(glob.glob(os.path.join(log_dir, 'iteration_*.jpg')))
    if not frames:
        print('[vid_metrics] No frames found, skipping.')
        return

    # 2. Stitch video at 2fps
    first = cv2.imread(frames[0])
    h, w = first.shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video_path = os.path.join(log_dir, 'mission_video.mp4')
    writer = cv2.VideoWriter(video_path, fourcc, 2, (w, h))
    for f in frames:
        writer.write(cv2.imread(f))
    writer.release()
    print(f'[vid_metrics] Video saved: {video_path}')

    # 3. Sample every 3rd frame, max 20
    sampled = frames[::3][:20]

    # 4. Encode to base64
    def encode(path):
        _, buf = cv2.imencode('.jpg', cv2.imread(path))
        return base64.b64encode(buf).decode('utf-8')

    image_messages = [
        {
            'type': 'image_url',
            'image_url': {'url': f'data:image/jpeg;base64,{encode(f)}'}
        }
        for f in sampled
    ]

    # 5. Build prompt
    prompt_text = (
        'These images are sampled frames from a drone mission in chronological order. '
        'Analyze the entire run and return ONLY this JSON with no other text:\n'
        '{\n'
        '  "collision_detected": bool,\n'
        '  "navigation_quality_score": int 1-10,\n'
        '  "behavioral_summary": string max 2 sentences,\n'
        f'  {BENCHMARK_SPECIFIC_FIELD}\n'
        '}'
    )

    # 6. Call VLM
    client = OpenAI()
    response = client.chat.completions.create(
        model='gpt-4o',
        messages=[{
            'role': 'user',
            'content': [{'type': 'text', 'text': prompt_text}] + image_messages
        }],
        max_tokens=400
    )
    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if raw.startswith('```'):
        raw = raw.split('\n', 1)[1].rsplit('```', 1)[0].strip()

    # 7. Write output
    try:
        result = json.loads(raw)
        result['scenario_id'] = scenario_id
        out_path = os.path.join(log_dir, 'metrics_vlm.json')
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f'\n📊 [vid_metrics] VLM Metrics:')
        print(json.dumps(result, indent=2))
        print(f'[vid_metrics] VLM metrics written: {out_path}')
    except json.JSONDecodeError as e:
        print(f"\n❌ [vid_metrics] Failed to parse VLM response as JSON: {e}")
        print(f"Raw VLM response:\n{raw}")
        result = {
            "scenario_id": scenario_id,
            "error": "Failed to parse VLM JSON response",
            "raw_response": raw
        }
        out_path = os.path.join(log_dir, 'metrics_vlm_error.json')
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f'[vid_metrics] Saved raw response to: {out_path}')
