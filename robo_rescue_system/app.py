import os
import io
import json
import time
import datetime
import math
import sqlite3
import threading

import numpy as np
import cv2
import requests
from flask import (
    Flask, request, jsonify, render_template,
    Response, send_file
)
from ultralytics import YOLO

app = Flask(__name__)

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------
DB_PATH = "telemetry.db"
FRAMES_DIR = "frames"
WEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")  # set for real temp

os.makedirs(FRAMES_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# LOAD YOLO (YOLOv8 nano - fast for edge/mobile)
# ----------------------------------------------------------------------------
print("[*] Loading YOLOv8 model ...")
model = YOLO("yolov8n.pt")

# Risk weighting for the "critical score" (COCO class names)
RISK_WEIGHTS = {
    "person": 0.9,
    "cell phone": 0.4,   # survivor may be calling for help
    "backpack": 0.3,
    "bottle": 0.2,       # water bottle -> survivor nearby
    "chair": 0.2,
    "dining table": 0.1,
}

# Urgency keywords for voice NLP
URGENCY_KEYWORDS = {
    "help": 1.0, "trapped": 1.0, "hurt": 0.9, "bleeding": 1.0,
    "fire": 1.0, "dying": 1.0, "save": 0.8, "pain": 0.7,
    "stuck": 0.8, "water": 0.5, "please": 0.4, "cant": 0.7,
}

# In-memory state for the live dashboard (frame kept here, not in DB)
latest_state = {
    "timestamp": None,
    "lat": None,
    "lon": None,
    "temperature": None,
    "detections": [],
    "critical_score": 0.0,
    "voice_text": "",
    "urgency": "",
    "frame": None,  # jpeg bytes
}
db_lock = threading.Lock()


# ----------------------------------------------------------------------------
# DATABASE (SQLite prototype - swap with MongoDB/TimescaleDB later)
# ----------------------------------------------------------------------------
def init_db():
    with sqlite3.connect(DB_PATH) as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT,
                lat REAL, lon REAL,
                temperature REAL,
                detections TEXT,
                critical_score REAL,
                voice_text TEXT,
                urgency TEXT,
                frame_path TEXT
            )"""
        )


init_db()


# ----------------------------------------------------------------------------
# HELPERS
# ----------------------------------------------------------------------------
def get_temperature(lat, lon):
    """Fetch real temperature from OpenWeatherMap, else simulate."""
    if WEATHER_API_KEY and lat is not None:
        try:
            r = requests.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": lat, "lon": lon,
                        "appid": WEATHER_API_KEY, "units": "metric"},
                timeout=5,
            )
            return float(r.json()["main"]["temp"])
        except Exception:
            pass
    # simulated temperature (smooth daily swing)
    return round(25 + 5 * math.sin(time.time() / 3600), 1)


def compute_critical_score(detections):
    """Weighted score from detected objects (0..1)."""
    score = 0.0
    for d in detections:
        w = RISK_WEIGHTS.get(d["class"], 0.1)
        score += w * d["confidence"]
    return round(min(score, 1.0), 3)


def analyze_voice(text):
    """Lightweight NLP: urgency scoring from keywords + simple sentiment."""
    if not text:
        return ("", 0.0)
    t = text.lower()
    score = 0.0
    for k, v in URGENCY_KEYWORDS.items():
        if k in t:
            score += v
    score = round(min(score, 1.0), 3)
    level = "HIGH" if score >= 0.7 else ("MEDIUM" if score >= 0.3 else "LOW")
    return (level, score)


# ----------------------------------------------------------------------------
# ROUTES - PAGES
# ----------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


# ----------------------------------------------------------------------------
# ROUTES - DETECTION (YOLO)
# ----------------------------------------------------------------------------
@app.route("/detect", methods=["POST"])
def detect():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "no image"}), 400

    img_bytes = file.read()
    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"error": "bad image"}), 400

    results = model(frame, verbose=False)[0]
    detections = []
    annotated = frame.copy()
    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        name = model.names[cls]
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        detections.append({
            "class": name,
            "confidence": round(conf, 3),
            "bbox": [round(x1), round(y1), round(x2), round(y2)],
        })
        cv2.rectangle(annotated, (int(x1), int(y1)),
                      (int(x2), int(y2)), (0, 255, 0), 2)
        cv2.putText(annotated, f"{name} {conf:.2f}",
                    (int(x1), int(y1) - 5), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, (0, 255, 0), 1)

    score = compute_critical_score(detections)
    _, buf = cv2.imencode(".jpg", annotated)

    latest_state["frame"] = buf.tobytes()
    latest_state["detections"] = detections
    latest_state["critical_score"] = score

    return jsonify({"detections": detections, "critical_score": score})


# ----------------------------------------------------------------------------
# ROUTES - TELEMETRY (GPS + voice + temp -> store)
# ----------------------------------------------------------------------------
@app.route("/telemetry", methods=["POST"])
def telemetry():
    data = request.get_json(force=True)
    lat = data.get("lat")
    lon = data.get("lon")
    voice = data.get("voice_text", "")

    temp = get_temperature(lat, lon)
    level, vscore = analyze_voice(voice)

    obj_score = latest_state["critical_score"]
    dets = latest_state["detections"]
    # overall critical score = max of object risk and voice urgency
    combined = max(obj_score, vscore) if voice else obj_score

    ts = datetime.datetime.now().isoformat()

    frame_path = None
    if latest_state["frame"]:
        frame_path = os.path.join(FRAMES_DIR, ts.replace(":", "-") + ".jpg")
        with open(frame_path, "wb") as f:
            f.write(latest_state["frame"])

    with db_lock, sqlite3.connect(DB_PATH) as c:
        c.execute(
            """INSERT INTO telemetry
               (ts,lat,lon,temperature,detections,critical_score,voice_text,urgency,frame_path)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (ts, lat, lon, temp, json.dumps(dets),
             combined, voice, level, frame_path),
        )

    latest_state.update({
        "timestamp": ts, "lat": lat, "lon": lon,
        "temperature": temp, "voice_text": voice, "urgency": level,
    })

    return jsonify({
        "ok": True,
        "critical_score": combined,
        "urgency": level,
        "temperature": temp,
        "datetime": ts,
    })


# ----------------------------------------------------------------------------
# ROUTES - DASHBOARD FEED
# ----------------------------------------------------------------------------
@app.route("/frame.jpg")
def frame_jpg():
    if latest_state["frame"]:
        return send_file(io.BytesIO(latest_state["frame"]),
                         mimetype="image/jpeg")
    return Response(status=204)


@app.route("/stream")
def stream():
    """Server-Sent Events for the live dashboard."""
    def gen():
        while True:
            time.sleep(1)
            payload = {k: v for k, v in latest_state.items() if k != "frame"}
            yield f"data: {json.dumps(payload)}\n\n"
    return Response(gen(), mimetype="text/event-stream")


@app.route("/api/history")
def history():
    with sqlite3.connect(DB_PATH) as c:
        rows = c.execute(
            "SELECT ts,lat,lon,temperature,critical_score,voice_text,urgency "
            "FROM telemetry ORDER BY id DESC LIMIT 50"
        ).fetchall()
    out = [
        {"ts": r[0], "lat": r[1], "lon": r[2], "temperature": r[3],
         "critical_score": r[4], "voice_text": r[5], "urgency": r[6]}
        for r in rows
    ]
    return jsonify(out)


if __name__ == "__main__":
    # host=0.0.0.0 so the phone can reach it over LAN
    app.run(host="0.0.0.0", port=5000, debug=True)
