# Guardian AI

Guardian AI is a hackathon prototype for a privacy-first CCTV intelligence dashboard. It shows selected surveillance feeds, overlays object detection metadata, masks faces by default, generates live incident notes while footage plays, and reveals an action-taken report after review.

### Detect Behavior. Protect Privacy.

Guardian AI is an AI-powered threat intelligence platform designed to solve one of the biggest problems in modern surveillance systems: the conflict between public safety and individual privacy.

Traditional mass surveillance systems continuously record and expose the identities of citizens, even when those individuals have done nothing wrong. This creates serious privacy concerns while still requiring human operators to manually monitor hundreds of camera feeds.

Guardian AI introduces a privacy-first approach.

By default, every individual's face is automatically anonymized using dynamic privacy masking. Security operators can observe behavior, movement patterns, interactions, and potential threats without immediately accessing a person's identity.

Instead of focusing on who someone is, Guardian AI focuses on what is happening.

Using computer vision and behavioral analysis, the system can identify incidents such as:

* Robbery attempts
* Chain snatching
* Suspicious following or stalking
* Public safety threats
* Vehicle accidents
* Unusual crowd behavior
* Emergency situations

When an incident is detected, Guardian AI generates an explainable incident report describing the observed behavior, risk level, and recommended actions.

Identity access is not granted automatically.

If an operator needs to reveal an individual's face, they must provide a valid operational justification. Every identity access request is logged, audited, and tied to a specific operator, ensuring accountability and preventing misuse of surveillance powers.

## Example: Highway Accident

A serious vehicle accident occurs on a highway.

Guardian AI detects the event and immediately:

* Generates an incident report.
* Alerts emergency services.
* Notifies nearby patrol units.
* Escalates the situation to the operations center.

If authorized personnel determine identity access is necessary, Guardian AI can use approved databases to assist emergency response teams in identifying victims and helping notify family members more quickly.

## Example: Robbery or Chain Snatching

A robbery occurs in a public area.

Guardian AI detects suspicious behavior, analyzes the incident, and immediately alerts nearby patrol teams.

An authorized operator may request identity access for investigative purposes. Once approved, law enforcement can rapidly begin response procedures while victim assistance teams are dispatched to support the affected individual.

This reduces response time, improves public safety, and helps authorities act before suspects disappear or evidence is lost.

## Our Vision

Guardian AI aims to transform surveillance systems from passive recording tools into privacy-preserving intelligence platforms.

The goal is not to watch everyone.

The goal is to understand dangerous situations, respond faster, and protect both public safety and personal privacy.


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
