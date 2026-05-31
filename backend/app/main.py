from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class Camera(BaseModel):
    id: str
    label: str
    file: str
    risk: str
    title: str
    score: int
    confidence: int
    tracks: int


CAMERAS = [
    Camera(id="cam-01", label="MAIN ENTRANCE", file="robbery.mp4", risk="high", title="Street Snatching / Assault", score=88, confidence=86, tracks=4),
    Camera(id="cam-02", label="RESIDENTIAL ROAD", file="park.mp4", risk="high", title="Chain Snatching / Suspicious Following", score=91, confidence=89, tracks=4),
    Camera(id="cam-03", label="PUBLIC PARK", file="video3.mp4", risk="normal", title="Routine Park Activity", score=14, confidence=93, tracks=4),
    Camera(id="cam-04", label="HOTEL LOBBY", file="video4.mp4", risk="critical", title="Armed Robbery Attempt", score=95, confidence=91, tracks=4),
    Camera(id="cam-05", label="DRIVING TEST ROUTE", file="video5.mp4", risk="medium", title="Driving Test Crash", score=62, confidence=88, tracks=4),
    Camera(id="cam-06", label="APARTMENT DRIVEWAY", file="video8.mp4", risk="normal", title="Pedestrian Street Crossing", score=21, confidence=82, tracks=0),
]

app = FastAPI(title="Guardian AI Vision API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "guardian-ai-vision-api"}


@app.get("/api/cameras")
def list_cameras() -> list[Camera]:
    return CAMERAS


@app.post("/api/audit/reveal-face")
def reveal_face(payload: dict[str, Any]) -> dict[str, Any]:
    camera_id = str(payload.get("camera_id", "unknown"))
    reason = str(payload.get("reason", "incident response"))
    return {
        "approved": True,
        "camera_id": camera_id,
        "expires_in_seconds": 90,
        "audit": f"{datetime.utcnow().isoformat()}Z -- FACE REVEAL AUTHORIZED on {camera_id}. Reason: {reason}.",
    }


@app.websocket("/ws/cameras/{camera_id}")
async def camera_stream(websocket: WebSocket, camera_id: str) -> None:
    await websocket.accept()
    camera = next((item for item in CAMERAS if item.id == camera_id), CAMERAS[0])
    tick = 0
    try:
        while True:
            await websocket.send_json(
                {
                    "camera_id": camera.id,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "risk": camera.risk,
                    "score": camera.score,
                    "confidence": camera.confidence,
                    "tracks": camera.tracks,
                    "privacy_mask": True,
                    "frame_index": tick,
                }
            )
            tick += 1
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
