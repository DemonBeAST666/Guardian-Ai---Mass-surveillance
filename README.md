# Guardian AI

Guardian AI is a hackathon prototype for a privacy-first CCTV intelligence dashboard. It shows selected surveillance feeds, overlays object detection metadata, masks faces by default, generates live incident notes while footage plays, and reveals an action-taken report after review.

## Features

- Six curated camera feeds with focused incident summaries.
- Dark security-operations dashboard built with Next.js and React.
- Live grid view and single-camera focus review.
- Face masking and temporary audited reveal flow.
- AI-style telemetry, risk score, confidence, and action recommendations.
- Generated PDF action-taken report.
- FastAPI backend stub for camera metadata, audit events, and future live streams.

## Demo Feeds

| Camera | Video | Scenario |
| --- | --- | --- |
| CAM-01 | `robbery.mp4` | Street snatching / assault |
| CAM-02 | `park.mp4` | Chain snatching / suspicious following |
| CAM-03 | `video3.mp4` | Normal public activity |
| CAM-04 | `video4.mp4` | Armed robbery attempt |
| CAM-05 | `video5.mp4` | Driving test crash |
| CAM-06 | `video8.mp4` | Pedestrian street crossing |

## Project Structure

```text
guardian-ai-next-fastapi/
  frontend/      Next.js dashboard
  backend/       FastAPI service stub
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. If port `3000` is busy, Next.js may run on `3001`.

## Run Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/health
```

## Build Check

```bash
cd frontend
npm run build
```

## GitHub Upload

From the project root:

```bash
git init
git add .
git commit -m "Initial Guardian AI prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPOSITORY` with your GitHub account and repository name.

## Notes

The current dashboard uses local MP4 demo files from `frontend/public/media`. The backend is ready as a stub for future live metadata, WebSocket camera streams, and real computer-vision inference.
