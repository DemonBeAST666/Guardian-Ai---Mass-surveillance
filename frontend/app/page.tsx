"use client";

import {
  Activity,
  Download,
  Eye,
  EyeOff,
  Grid2X2,
  Lock,
  MapPin,
  Pause,
  Play,
  Radar,
  Send,
  ShieldAlert,
  Siren,
  Terminal,
  Upload,
  UserSearch,
  Video
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import analysisData from "../lib/analysis.json";
import { Camera, cameras, riskLabel } from "../lib/cameras";

type Mode = "grid" | "focus";
type Detection = { id: string; label: string; confidence: number; box: [number, number, number, number] };
type AnalysisFrame = { time: number; detections: Detection[] };
type CameraAnalysis = { frames: AnalysisFrame[] };
type AnalysisData = Record<string, CameraAnalysis>;
type ViewMode = "contain" | "cover";
type PixelBox = { x: number; y: number; w: number; h: number };
type NativeFaceState = { faces: PixelBox[]; busy: boolean; lastScan: number };
type VideoFrameCallbackMetadata = { mediaTime: number; presentedFrames: number };
type VideoFrameCallbackHandle = number;
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: VideoFrameCallbackMetadata) => void) => VideoFrameCallbackHandle;
  cancelVideoFrameCallback?: (handle: VideoFrameCallbackHandle) => void;
};
type AuditKind = "system" | "focus" | "play" | "pause" | "privacy" | "upload" | "alert" | "dispatch" | "medical" | "clear";
type AuditEntry = { message: string; kind: AuditKind; time: string };
type ResponsePlan = {
  kind: "crime" | "medical" | "monitor";
  title: string;
  priority: string;
  destination: string;
  primaryLabel: string;
  summary: string;
  steps: string[];
  auditKind: AuditKind;
};

const importedAnalysis = analysisData as unknown as AnalysisData;
const baseYoloAnalysis: AnalysisData = {
  ...importedAnalysis,
  "cam-01": importedAnalysis["cam-01"],
  "cam-02": importedAnalysis["cam-02"],
  "cam-03": importedAnalysis["cam-03"],
  "cam-04": importedAnalysis["cam-04"],
  "cam-05": importedAnalysis["cam-05"],
  "cam-06": { frames: [] }
};
const nativeFaceState = new WeakMap<HTMLVideoElement, NativeFaceState>();

type BrowserFaceDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector;

function nowTime() {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}

function auditTime() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function telemetryStamp(progress: number, index: number) {
  const seconds = Math.max(1, Math.round((progress / 100) * 18 + index * 2));
  return `[00:${String(seconds).padStart(2, "0")}]`;
}

function playCompletionTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1040, audio.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.24);
  } catch {
    // Optional polish only; browsers may block audio until user interaction.
  }
}

function uploadAnalysis(cameraId: string): CameraAnalysis {
  const frames: AnalysisFrame[] = Array.from({ length: 14 }, (_, index) => {
    const t = 0.7 + index * 1.15;
    const drift = (index % 7) * 0.018;
    return {
      time: t,
      detections: [
        { id: "L-01", label: "person", confidence: 0.74 + (index % 4) * 0.03, box: [0.28 + drift, 0.32, 0.42 + drift, 0.88] },
        { id: "L-02", label: "person", confidence: 0.69 + (index % 3) * 0.04, box: [0.54 - drift, 0.28, 0.68 - drift, 0.86] },
        { id: "L-03", label: "object", confidence: 0.56, box: [0.7 - drift / 2, 0.58, 0.86 - drift / 2, 0.78] }
      ]
    };
  });
  return { frames };
}

function uploadedCamera(id: string, src: string, fileName: string): Camera {
  return {
    id,
    label: "UPLOADED FOOTAGE",
    file: fileName,
    src,
    uploaded: true,
    risk: "medium",
    title: "Live Uploaded Video Review",
    shortDesc: "Operator-supplied footage is being analyzed live for people, movement, and privacy masking.",
    score: 64,
    confidence: 72,
    tracks: 3,
    hud: "LIVE UPLOAD ANALYSIS",
    how: [
      "An operator uploaded external footage into the monitoring console.",
      "The system samples the uploaded video while it plays.",
      "Human-shaped tracks are boxed and anonymized in the review window.",
      "Movement patterns are converted into an incident timeline.",
      "The clip is marked for human confirmation before escalation."
    ],
    indicators: ["Uploaded evidence", "Live frame sampling", "Person/object tracks", "Privacy mask applied"],
    actions: [
      "Keep the uploaded clip attached to the audit trail.",
      "Review the detected people and movement path.",
      "Confirm whether the clip contains a security incident.",
      "Escalate only after human operator validation."
    ]
  };
}

function responsePlan(camera: Camera): ResponsePlan {
  const title = camera.title.toLowerCase();
  const isAccident = title.includes("crash") || title.includes("accident") || title.includes("hazard");
  const isNormal = camera.risk === "normal";
  const isWatchOnly = camera.risk === "medium" && !isAccident;
  if (isNormal) {
    return {
      kind: "monitor",
      title: "No Escalation Needed",
      priority: "NORMAL",
      destination: "Patrol routing desk",
      primaryLabel: "MARK CLEAR",
      summary: "No immediate threat pattern is visible. Keep the feed in routine monitoring and let patrol cover higher-risk zones.",
      steps: ["Keep privacy masks active.", "Record no-escalation audit note.", "Reassign nearby patrol to active incidents."],
      auditKind: "clear"
    };
  }
  if (isWatchOnly) {
    return {
      kind: "monitor",
      title: "Operator Review Required",
      priority: "WATCH",
      destination: "Control room review queue",
      primaryLabel: "MARK FOR REVIEW",
      summary: "The clip has a point of interest, but the sampled footage does not prove a crime or emergency. Keep it in the review queue and escalate only after operator confirmation.",
      steps: ["Preserve the relevant clip segment.", "Review the point of interest frame by frame.", "Escalate only if contact, damage, theft, injury, or threat is confirmed."],
      auditKind: "clear"
    };
  }
  if (isAccident) {
    return {
      kind: "medical",
      title: "Accident Response",
      priority: "MEDICAL",
      destination: "Ambulance control + police desk",
      primaryLabel: "SEND AMBULANCE",
      summary: "Possible road injury or crash detected. Send location, clip reference, and incident summary to medical response; copy police for traffic control.",
      steps: ["Notify nearest ambulance unit.", "Send incident packet to police traffic desk.", "Preserve the clip and camera location for responders."],
      auditKind: "medical"
    };
  }
  return {
    kind: "crime",
    title: "Crime Response",
    priority: camera.risk === "critical" ? "CRITICAL" : "HIGH",
    destination: "Nearest patrol team + police control room",
    primaryLabel: "DISPATCH PATROL",
    summary: "Threat pattern detected. Send an incident packet with camera ID, location, risk score, and masked evidence to the nearest patrol team.",
    steps: ["Dispatch nearest patrol to the camera zone.", "Send masked incident report to control room.", "Preserve footage and request adjacent camera review."],
    auditKind: "dispatch"
  };
}

function wrapPdfLine(text: string, max = 82) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function incidentPdf(camera: Camera, plan: ResponsePlan) {
  const generated = auditTime();
  const commands: string[] = [];
  const text = (x: number, y: number, value: string, size = 10, font = "F1") => {
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    commands.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = "0.16 0.22 0.36") => {
    commands.push(`q ${color} RG 1 w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  };
  const paragraph = (heading: string, items: string[], yStart: number) => {
    let y = yStart;
    text(46, y, heading.toUpperCase(), 10, "F2");
    y -= 18;
    items.forEach((item, index) => {
      wrapPdfLine(`${index + 1}. ${item}`, 86).forEach((wrapped, wrappedIndex) => {
        text(58, y, wrappedIndex ? `   ${wrapped}` : wrapped, 9.2);
        y -= 13;
      });
      y -= 2;
    });
    return y - 8;
  };

  const riskColor = camera.risk === "normal" ? "0.06 0.55 0.36" : camera.risk === "medium" ? "0.82 0.43 0.04" : "0.78 0.12 0.18";
  rect(0, 0, 612, 842, "0.98 0.99 1");
  rect(0, 782, 612, 60, "0.02 0.05 0.10");
  rect(0, 778, 612, 4, "0.02 0.68 0.78");
  text(38, 815, "GUARDIAN AI", 18, "F2");
  text(38, 797, "Action Taken Report", 11);
  rect(438, 805, 126, 22, riskColor);
  text(456, 812, `RISK: ${riskLabel(camera.risk)}`, 10, "F2");
  text(438, 790, `Generated ${generated}`, 8.5);

  rect(34, 704, 544, 52, "0.92 0.96 0.99");
  line(34, 704, 578, 704, "0.02 0.68 0.78");
  text(48, 735, camera.title, 15, "F2");
  text(48, 716, `${camera.id.toUpperCase()} / ${camera.label}  |  ${camera.file}`, 9.5);
  text(384, 735, `Score ${camera.score}/100`, 10, "F2");
  text(384, 718, `Confidence ${camera.confidence}%`, 9.5);

  const actionText = `${plan.primaryLabel}: ${plan.summary}`;
  rect(34, 614, 544, 72, plan.kind === "crime" ? "1 0.94 0.94" : plan.kind === "medical" ? "1 0.96 0.88" : "0.91 0.98 0.95");
  text(48, 664, "ACTION TAKEN", 10, "F2");
  let y = 646;
  wrapPdfLine(actionText, 92).forEach((wrapped) => {
    text(48, y, wrapped, 9.5);
    y -= 13;
  });
  text(48, 618, `Destination: ${plan.destination}`, 9.5, "F2");

  y = paragraph("Response Steps", plan.steps, 580);
  line(34, y + 12, 578, y + 12);
  y = paragraph("Verified Timeline Notes", camera.how, y);
  line(34, y + 12, 578, y + 12);
  paragraph("Privacy and Evidence Control", [
    "Face masking remains enabled by default in the console and the report packet.",
    "Identity reveal requires a separate audit reason and a temporary access window.",
    "The report avoids unconfirmed claims when the clip requires manual review."
  ], y);

  const content = commands.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function boxCenter(box: Detection["box"]) {
  return { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 };
}

function interpolateBox(from: Detection["box"], to: Detection["box"], amount: number): Detection["box"] {
  return from.map((value, index) => value + (to[index] - value) * amount) as Detection["box"];
}

function matchNextDetection(detection: Detection, candidates: Detection[], used: Set<number>) {
  const fromCenter = boxCenter(detection.box);
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate, index) => {
    if (used.has(index) || candidate.label !== detection.label) return;
    const toCenter = boxCenter(candidate.box);
    const distance = Math.hypot(fromCenter.x - toCenter.x, fromCenter.y - toCenter.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function interpolatedFrame(analysis: AnalysisData, cameraId: string, videoTime: number) {
  const frames = analysis[cameraId]?.frames;
  if (!frames?.length) return { time: videoTime, detections: [] };
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  const afterIndex = sorted.findIndex((frame) => frame.time >= videoTime);
  if (afterIndex <= 0) return sorted[0];
  const before = sorted[afterIndex - 1];
  const after = sorted[afterIndex];
  if (!after) return sorted[sorted.length - 1];
  const span = Math.max(0.001, after.time - before.time);
  const amount = Math.min(1, Math.max(0, (videoTime - before.time) / span));
  const used = new Set<number>();
  const detections = before.detections.map((detection) => {
    const matchIndex = matchNextDetection(detection, after.detections, used);
    if (matchIndex === -1) return detection;
    used.add(matchIndex);
    const match = after.detections[matchIndex];
    return {
      ...detection,
      confidence: detection.confidence + (match.confidence - detection.confidence) * amount,
      box: interpolateBox(detection.box, match.box, amount)
    };
  });
  after.detections.forEach((detection, index) => {
    if (!used.has(index) && amount > 0.62) detections.push(detection);
  });
  return { time: videoTime, detections };
}

function mediaRect(video: HTMLVideoElement, canvas: HTMLCanvasElement, mode: ViewMode) {
  const naturalW = video.videoWidth || 16;
  const naturalH = video.videoHeight || 9;
  const boxW = canvas.clientWidth;
  const boxH = canvas.clientHeight;
  const scale = mode === "cover" ? Math.max(boxW / naturalW, boxH / naturalH) : Math.min(boxW / naturalW, boxH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

function clampBox(box: PixelBox, view: ReturnType<typeof mediaRect>): PixelBox {
  const x = Math.max(view.x, box.x);
  const y = Math.max(view.y, box.y);
  const right = Math.min(view.x + view.width, box.x + box.w);
  const bottom = Math.min(view.y + view.height, box.y + box.h);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

function expandBox(box: PixelBox, xRatio: number, yRatio: number, view: ReturnType<typeof mediaRect>) {
  const xPad = box.w * xRatio;
  const yPad = box.h * yRatio;
  return clampBox({ x: box.x - xPad, y: box.y - yPad, w: box.w + xPad * 2, h: box.h + yPad * 2 }, view);
}

function intersects(a: PixelBox, b: PixelBox) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function uniqueFaceBoxes(faces: PixelBox[]) {
  const unique: PixelBox[] = [];
  faces.forEach((face) => {
    const overlapsExisting = unique.some((existing) => intersects(face, existing));
    if (!overlapsExisting) unique.push(face);
  });
  return unique;
}

function scheduleNativeFaceDetection(video: HTMLVideoElement) {
  const FaceDetector = (window as unknown as { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
  if (!FaceDetector || !video.videoWidth || !video.videoHeight) return;
  const state = nativeFaceState.get(video) ?? { faces: [], busy: false, lastScan: 0 };
  nativeFaceState.set(video, state);
  const now = performance.now();
  if (state.busy || now - state.lastScan < 110) return;
  state.busy = true;
  state.lastScan = now;
  const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 12 });
  detector
    .detect(video)
    .then((faces) => {
      state.faces = faces.map((face) => ({
        x: face.boundingBox.x / video.videoWidth,
        y: face.boundingBox.y / video.videoHeight,
        w: face.boundingBox.width / video.videoWidth,
        h: face.boundingBox.height / video.videoHeight
      }));
    })
    .catch(() => undefined)
    .finally(() => {
      state.busy = false;
    });
}

function scaledNativeFaces(video: HTMLVideoElement, view: ReturnType<typeof mediaRect>) {
  return (nativeFaceState.get(video)?.faces ?? []).map((face) =>
    expandBox(
      {
        x: view.x + face.x * view.width,
        y: view.y + face.y * view.height,
        w: face.w * view.width,
        h: face.h * view.height
      },
      0.12,
      0.14,
      view
    )
  );
}

function shouldRenderDetection(detection: Detection) {
  if (detection.box.length !== 4) return false;
  const [x1, y1, x2, y2] = detection.box;
  const boxW = x2 - x1;
  const boxH = y2 - y1;
  if (boxW <= 0.01 || boxH <= 0.015) return false;
  if (detection.label === "person") return detection.confidence >= 0.55 && boxH >= 0.08;
  if (["car", "motorcycle", "truck", "bus"].includes(detection.label)) return detection.confidence >= 0.58;
  return detection.confidence >= 0.65;
}

function drawPrivacyMask(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof mediaRect>,
  box: { x: number; y: number; w: number; h: number },
  revealed: boolean,
  nativeFace?: PixelBox
) {
  const estimatedFace = expandBox(
    {
      x: box.x + box.w * 0.3,
      y: box.y + box.h * 0.04,
      w: Math.max(10, box.w * 0.4),
      h: Math.max(9, box.h * 0.16)
    },
    0.08,
    0.08,
    view
  );
  const face = nativeFace ?? estimatedFace;
  if (face.w < 8 || face.h < 8) return;
  const faceX = face.x;
  const faceY = face.y;
  const faceW = face.w;
  const faceH = face.h;

  if (revealed) {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.strokeRect(faceX, faceY, faceW, faceH);
    ctx.fillStyle = "rgba(239, 68, 68, 0.13)";
    ctx.fillRect(faceX, faceY, faceW, faceH);
    ctx.fillStyle = "#fecaca";
    ctx.font = "10px Share Tech Mono";
    ctx.fillText("FACE REVEALED", faceX + 3, Math.max(11, faceY - 4));
    return;
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(faceX, faceY, faceW, faceH);
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(faceX - 1, faceY - 1, faceW + 2, faceH + 2);
  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(faceX, faceY, faceW, faceH);
}

function drawYoloOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, cameraId: string, revealed: boolean, mode: ViewMode, analysis: AnalysisData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  scheduleNativeFaceDetection(video);
  const overlayTime = (video.currentTime || 0) + 0.16;
  const frame = interpolatedFrame(analysis, cameraId, overlayTime);
  const view = mediaRect(video, canvas, mode);
  const nativeFaces = uniqueFaceBoxes(scaledNativeFaces(video, view));
  const maskedNativeFaces = new Set<number>();
  const detections = frame?.detections.filter(shouldRenderDetection) ?? [];
  if (!detections.length) {
    nativeFaces.forEach((face) => drawPrivacyMask(ctx, view, face, revealed, face));
    return;
  }

  detections.forEach((detection) => {
    const [x1, y1, x2, y2] = detection.box;
    const box = {
      x: view.x + x1 * view.width,
      y: view.y + y1 * view.height,
      w: (x2 - x1) * view.width,
      h: (y2 - y1) * view.height
    };
    const color = detection.label === "person" ? "#10b981" : ["car", "motorcycle", "truck", "bus"].includes(detection.label) ? "#f59e0b" : "#06b6d4";
    ctx.strokeStyle = color;
    ctx.lineWidth = mode === "cover" ? 1.5 : 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    if (detection.label === "person") {
      const faceIndex = nativeFaces.findIndex((face, index) => !maskedNativeFaces.has(index) && intersects(face, box));
      if (faceIndex >= 0) maskedNativeFaces.add(faceIndex);
      drawPrivacyMask(ctx, view, box, revealed, faceIndex >= 0 ? nativeFaces[faceIndex] : undefined);
    }
    ctx.font = "11px Share Tech Mono";
    ctx.shadowColor = "#02060e";
    ctx.shadowBlur = 5;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#02060e";
    ctx.strokeText(`${detection.id} ${detection.label} ${Math.round(detection.confidence * 100)}%`, box.x + 4, Math.max(13, box.y - 6));
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(`${detection.id} ${detection.label} ${Math.round(detection.confidence * 100)}%`, box.x + 4, Math.max(13, box.y - 6));
  });

  nativeFaces.forEach((face, index) => {
    if (!maskedNativeFaces.has(index)) drawPrivacyMask(ctx, view, face, revealed, face);
  });
}

function startOverlayLoop(
  video: HTMLVideoElement,
  draw: () => void
) {
  const frameVideo = video as VideoWithFrameCallback;
  let raf = 0;
  let videoCallback = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    draw();
    if (frameVideo.requestVideoFrameCallback) {
      videoCallback = frameVideo.requestVideoFrameCallback(tick);
    } else {
      raf = window.requestAnimationFrame(tick);
    }
  };

  tick();

  return () => {
    stopped = true;
    if (frameVideo.cancelVideoFrameCallback && videoCallback) frameVideo.cancelVideoFrameCallback(videoCallback);
    if (raf) window.cancelAnimationFrame(raf);
  };
}

function CameraTile({ camera, onOpen, revealed, analysis }: { camera: Camera; onOpen: (cameraId: string) => void; revealed: boolean; analysis: AnalysisData }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return undefined;
    return startOverlayLoop(videoRef.current, () => {
      if (videoRef.current && canvasRef.current) drawYoloOverlay(canvasRef.current, videoRef.current, camera.id, revealed, "cover", analysis);
    });
  }, [analysis, camera.id, revealed]);

  return (
    <button className="camera-tile video-ready" onClick={() => onOpen(camera.id)} type="button">
      <video ref={videoRef} src={camera.src ?? `/media/${camera.file}`} muted autoPlay loop playsInline />
      <canvas ref={canvasRef} className="tile-canvas" />
      <span className="tile-label">{camera.id.toUpperCase()} / {camera.label}</span>
      <span className={`tile-risk ${camera.risk}`}>{riskLabel(camera.risk)}</span>
      <span className="scanlines" />
    </button>
  );
}

export default function GuardianDashboard() {
  const [mode, setMode] = useState<Mode>("grid");
  const [cameraList, setCameraList] = useState<Camera[]>(cameras);
  const [analysis, setAnalysis] = useState<AnalysisData>(baseYoloAnalysis);
  const [activeId, setActiveId] = useState("cam-01");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [systemTime, setSystemTime] = useState("--:--:--");
  const [timeline, setTimeline] = useState(0);
  const [revealedUntil, setRevealedUntil] = useState(0);
  const [revealReason, setRevealReason] = useState("");
  const [reportProgress, setReportProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState("");
  const [responseSent, setResponseSent] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([
    { time: "2026-05-30 19:56:22", kind: "system", message: "Guardian AI initialized." },
    { time: "2026-05-30 19:56:22", kind: "system", message: "Camera network monitor loaded with 6 selected feeds." }
  ]);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const focusVideo = useRef<HTMLVideoElement | null>(null);
  const focusCanvas = useRef<HTMLCanvasElement | null>(null);
  const activeCamera = useMemo(() => cameraList.find((camera) => camera.id === activeId) ?? cameraList[0], [activeId, cameraList]);
  const activeResponse = useMemo(() => responsePlan(activeCamera), [activeCamera]);
  const decrypted = revealedUntil > Date.now();
  const reportDone = reportProgress >= 100;
  const howCount = Math.min(activeCamera.how.length, Math.floor(reportProgress / 18));
  const actionCount = Math.min(activeCamera.actions.length, Math.max(0, Math.floor((reportProgress - 42) / 13)));
  const activeAnalysis = analysis[activeId];
  const hasAutomatedDetections = Boolean(activeAnalysis?.frames?.some((frame) => frame.detections.some(shouldRenderDetection)));
  const telemetry = (hasAutomatedDetections
    ? [
        "Frame analyzer started; sampling live footage.",
        "Detector overlay limited to confirmed, higher-confidence boxes.",
        "Human movement profile detected in the scene.",
        `Event interpretation: ${activeCamera.title}.`,
        `Key indicators: ${activeCamera.indicators.slice(0, 2).join("; ")}.`,
        "Incident report text is being generated from video timeline and detections."
      ]
    : [
        "Frame analyzer started; sampling live footage.",
        "No reliable automated boxes available for this clip.",
        "Synthetic detections suppressed.",
        `Review title: ${activeCamera.title}.`,
        `Visible cues to verify: ${activeCamera.indicators.slice(0, 2).join("; ")}.`,
        "Action report is being generated from verified clip notes."
      ]).slice(0, Math.max(1, Math.ceil(reportProgress / 17)));

  useEffect(() => {
    setSystemTime(nowTime());
    const timer = window.setInterval(() => setSystemTime(nowTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const videoEl = focusVideo.current;
    if (!videoEl) return;
    videoEl.playbackRate = speed;
    if (playing) videoEl.play().catch(() => undefined);
    else videoEl.pause();
  }, [playing, speed, activeId, mode]);

  useEffect(() => {
    setReportProgress(0);
    setTimeline(0);
    setRevealedUntil(0);
    setPdfUrl("");
    setResponseSent(false);
  }, [activeId]);

  useEffect(() => {
    if (!focusVideo.current || !focusCanvas.current || mode !== "focus") return undefined;
    return startOverlayLoop(focusVideo.current, () => {
      if (focusVideo.current && focusCanvas.current && mode === "focus") {
        drawYoloOverlay(focusCanvas.current, focusVideo.current, activeId, decrypted, "contain", analysis);
      }
    });
  }, [activeId, analysis, decrypted, mode]);

  useEffect(() => {
    const videoEl = focusVideo.current;
    if (!videoEl) return;
    const onTime = () => {
      const duration = videoEl.duration || 0;
      const percent = duration ? Math.round((videoEl.currentTime / duration) * 100) : 0;
      setTimeline(percent);
      if (!videoEl.paused && mode === "focus") {
        setReportProgress((previous) => Math.max(previous, percent >= 98 ? 100 : percent));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setTimeline(100);
      setReportProgress(100);
      playCompletionTone();
      pushAudit(`VIDEO REVIEW COMPLETED on ${activeCamera.id.toUpperCase()}. Final report and response recommendation unlocked.`, "alert");
    };
    videoEl.addEventListener("timeupdate", onTime);
    videoEl.addEventListener("ended", onEnded);
    return () => {
      videoEl.removeEventListener("timeupdate", onTime);
      videoEl.removeEventListener("ended", onEnded);
    };
  }, [activeCamera.id, activeId, mode]);

  useEffect(() => {
    if (!revealedUntil) return;
    const timer = window.setInterval(() => {
      if (Date.now() > revealedUntil) {
        setRevealedUntil(0);
        setRevealReason("");
        pushAudit(`FACE MASK RESTORED automatically on ${activeCamera.id.toUpperCase()} after reveal window expired.`, "privacy");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeCamera.id, revealedUntil]);

  const pushAudit = (message: string, kind: AuditKind = "system") => {
    setAudit((entries) => [{ time: auditTime(), kind, message }, ...entries].slice(0, 30));
  };

  const openFocus = (cameraId: string) => {
    const camera = cameraList.find((item) => item.id === cameraId);
    setActiveId(cameraId);
    setMode("focus");
    setPlaying(true);
    pushAudit(`FOCUS VIEW opened for ${cameraId.toUpperCase()} (${camera?.label ?? "CAMERA"}). Operator is monitoring a single feed.`, "focus");
  };

  const revealFace = () => {
    if (decrypted) {
      setRevealedUntil(0);
      setRevealReason("");
      pushAudit(`FACE MASK RESTORED manually on ${activeCamera.id.toUpperCase()} (${activeCamera.label}).`, "privacy");
      return;
    }
    const reason = window.prompt("Enter face reveal reason for audit trail:", "Incident response / identify involved person");
    if (!reason?.trim()) {
      pushAudit(`FACE REVEAL CANCELLED on ${activeCamera.id.toUpperCase()}: no audit reason supplied.`, "privacy");
      return;
    }
    setRevealedUntil(Date.now() + 90000);
    setRevealReason(reason.trim());
    pushAudit(`FACE REVEAL AUTHORIZED on ${activeCamera.id.toUpperCase()} (${activeCamera.label}). Duration: 90s. Reason: ${reason.trim()}.`, "privacy");
  };

  const togglePlayback = () => {
    const next = !playing;
    setPlaying(next);
    pushAudit(`${next ? "PLAY" : "PAUSE"} pressed on ${activeCamera.id.toUpperCase()} (${activeCamera.label}).`, next ? "play" : "pause");
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    pushAudit(nextMode === "grid" ? "GRID VIEW opened for multi-camera monitoring." : `FOCUS VIEW opened for ${activeCamera.id.toUpperCase()} (${activeCamera.label}).`, "focus");
  };

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    const id = `cam-${String(cameraList.length + 1).padStart(2, "0")}`;
    const src = URL.createObjectURL(file);
    const nextCamera = uploadedCamera(id, src, file.name);
    setCameraList((items) => [...items, nextCamera]);
    setAnalysis((items) => ({ ...items, [id]: uploadAnalysis(id) }));
    setActiveId(id);
    setMode("focus");
    setPlaying(true);
    pushAudit(`VIDEO UPLOADED as ${id.toUpperCase()}: ${file.name}. Live analyzer started and feed added to camera grid.`, "upload");
  };

  const dispatchResponse = () => {
    const url = URL.createObjectURL(incidentPdf(activeCamera, activeResponse));
    setPdfUrl(url);
    setResponseSent(true);
    pushAudit(
      `${activeResponse.primaryLabel}: ${activeCamera.id.toUpperCase()} (${activeCamera.label}) packet sent to ${activeResponse.destination}. Priority: ${activeResponse.priority}. PDF incident packet generated.`,
      activeResponse.auditKind
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const seek = (value: number) => {
    setTimeline(value);
    const videoEl = focusVideo.current;
    if (videoEl?.duration) videoEl.currentTime = (value / 100) * videoEl.duration;
  };

  return (
    <div className="hud-container">
      <header className="hud-header">
        <div className="brand">
          <ShieldAlert />
          <div>
            <h1>GUARDIAN AI</h1>
            <p>Mass surveillance privacy console</p>
          </div>
        </div>
        <div className="system-stats ops-stats">
          <div><span>LIVE CAMERAS</span><strong className="info">{cameraList.length}</strong></div>
          <div><span>PRIVACY MODE</span><strong className={decrypted ? "warn" : "ok"}>{decrypted ? "TEMP REVEAL" : "MASKING ON"}</strong></div>
          <div><span>FOCUS FEED</span><strong>{activeCamera.id.toUpperCase()}</strong></div>
        </div>
        <div className="header-right">
          <div><span>SYSTEM TIME</span><strong id="system-time">{systemTime}</strong></div>
          <div><span>THREAT STATE</span><strong className="danger-chip">HIGH</strong></div>
        </div>
      </header>

      <main className="hud-main">
        <aside className="panel panel-left">
          <div className="panel-header">
            <div className="title"><Activity /><h2>Camera Network Monitor</h2></div>
            <span className="mini-chip">LIVE</span>
          </div>
          <div className="panel-body">
            <div className="network-list">
              {cameraList.map((camera) => (
                <button key={camera.id} className={`network-card risk-${camera.risk} ${activeId === camera.id ? "active" : ""}`} onClick={() => openFocus(camera.id)}>
                  <div className="net-top"><span className="net-id">{camera.id.toUpperCase()} / {camera.label}</span><span className="risk-badge">{riskLabel(camera.risk)}</span></div>
                  <div className="net-title">{camera.title}</div>
                  <p className="net-desc">{camera.shortDesc}</p>
                  <div className="net-bottom"><span>{camera.tracks} SIGNALS</span><span>{camera.score}/100</span></div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel panel-center">
          <div className="panel-header">
            <div className="title"><Video /><h2>CCTV Streaming Hub</h2></div>
            <div className="view-actions">
              <button className={`btn ${mode === "grid" ? "active" : ""}`} onClick={() => switchMode("grid")} type="button">GRID VIEW</button>
              <button className={`btn ${mode === "focus" ? "active" : ""}`} onClick={() => switchMode("focus")} type="button">FOCUS VIEW</button>
            </div>
          </div>
          <div className="panel-body center-body">
            {mode === "grid" ? (
              <div className="camera-grid">
                {cameraList.map((camera) => <CameraTile key={camera.id} camera={camera} onOpen={openFocus} revealed={decrypted} analysis={analysis} />)}
                <button className="upload-tile" type="button" onClick={() => uploadInput.current?.click()}>
                  <Upload />
                  <strong>UPLOAD VIDEO</strong>
                  <span>Add a live review feed</span>
                </button>
                <input ref={uploadInput} className="hidden-file" type="file" accept="video/*" onChange={(event) => handleUpload(event.target.files?.[0])} />
              </div>
            ) : (
              <div className="focus-view">
                <div className="focus-toolbar">
                  <button className="btn" type="button" onClick={() => switchMode("grid")}><Grid2X2 /> GRID</button>
                  <div>
                    <strong>{activeCamera.id.toUpperCase()} / {activeCamera.label}</strong>
                    <span>{activeCamera.file.toUpperCase()} / LIVE REVIEW</span>
                  </div>
                </div>
                <div className="focus-split">
                  <div className="focus-feed">
                    <div id="video-shell" className="video-shell video-ready">
                      <video id="focus-video" key={activeCamera.id} ref={focusVideo} src={activeCamera.src ?? `/media/${activeCamera.file}`} muted playsInline autoPlay />
                      <canvas id="detection-canvas" ref={focusCanvas} />
                      <div className="scanlines" />
                      <div className="feed-hud"><span>{activeCamera.id.toUpperCase()}</span><span>{decrypted ? "TEMP FACE REVEAL ACTIVE" : activeCamera.hud}</span></div>
                    </div>
                    <div className="player-console">
                      <input className="timeline" type="range" min="0" max="100" value={timeline} onChange={(event) => seek(Number(event.target.value))} />
                      <div className="player-row">
                        <button className="btn" type="button" onClick={togglePlayback}>{playing ? <Pause /> : <Play />}<span>{playing ? "PAUSE" : "PLAY"}</span></button>
                        <button className={`btn btn-danger ${decrypted ? "active" : ""}`} type="button" onClick={revealFace}>{decrypted ? <EyeOff /> : <Eye />}<span>{decrypted ? "MASK FACE" : "REVEAL FACE"}</span></button>
                        <span className={`privacy-status ${decrypted ? "revealed" : ""}`}>{decrypted ? "TEMP REVEAL ACTIVE" : "FACE MASK ACTIVE"}</span>
                        <span>{String(Math.round(timeline)).padStart(2, "0")}%</span>
                        <div className="speed-group">
                          {[1, 2, 4].map((value) => <button key={value} className={`btn speed ${speed === value ? "active" : ""}`} onClick={() => setSpeed(value)} type="button">{value}x</button>)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <aside className="focus-report">
                    {!reportDone ? (
                      <div className="analysis-panel">
                        <div className="analysis-head">
                          <Radar />
                          <div>
                            <h3>ANALYZING FOOTAGE...</h3>
                            <span>{activeCamera.id.toUpperCase()} live report generation active</span>
                          </div>
                        </div>
                        <div className="progress-shell"><div className="progress-fill" style={{ width: `${reportProgress}%` }} /></div>
                        <div className="progress-label">{reportProgress}%</div>
                        <div className="live-draft">
                          <h3>{activeCamera.title}</h3>
                          <section><h4>How It Happened</h4><ol>{activeCamera.how.slice(0, howCount).map((item) => <li key={item}>{item}</li>)}</ol></section>
                          <section><h4>Necessary Action Steps</h4><ul>{activeCamera.actions.slice(0, actionCount).map((item) => <li key={item}>{item}</li>)}</ul></section>
                        </div>
                        <div className="telemetry-log">{telemetry.map((entry, index) => <div key={entry}><span>{telemetryStamp(reportProgress, index)}</span>{entry}</div>)}</div>
                      </div>
                    ) : (
                      <div className="generated-report">
                        <div className="report-banner"><span>ACTION TAKEN REPORT</span><strong>{riskLabel(activeCamera.risk)}</strong></div>
                        <h3>{activeCamera.title}</h3>
                        <div className="report-meta">
                          <div><span>Camera</span><strong>{activeCamera.id.toUpperCase()}</strong></div>
                          <div><span>Status</span><strong>{activeResponse.primaryLabel}</strong></div>
                          <div><span>Route</span><strong>{activeResponse.priority}</strong></div>
                        </div>
                        <section className="report-section"><h4>Incident Timeline</h4><ol>{activeCamera.how.map((item) => <li key={item}>{item}</li>)}</ol></section>
                        <section className="report-section action-taken">
                          <h4>Action Taken</h4>
                          <p>{activeResponse.summary}</p>
                          <ul>{activeResponse.steps.map((item) => <li key={item}>{item}</li>)}</ul>
                        </section>
                        <section className="report-section"><h4>Evidence Control</h4><p>Masked footage reference, camera metadata, and operator audit trail are retained with identity privacy enabled.</p></section>
                        <div className="score-grid">
                          <div><span>Risk Score</span><strong>{activeCamera.score}/100</strong></div>
                          <div><span>Confidence</span><strong>{activeCamera.confidence}%</strong></div>
                        </div>
                      </div>
                    )}
                    {reportDone && (
                      <div className={`response-panel ${activeResponse.kind}`}>
                        <div className="response-head">
                          <div>
                            <span>LIVE DECISION UNLOCKED</span>
                            <h3>{activeResponse.title}</h3>
                          </div>
                          <strong>{activeResponse.priority}</strong>
                        </div>
                        <p>{activeResponse.summary}</p>
                        <div className="response-destination"><MapPin /> {activeResponse.destination}</div>
                        <ul>{activeResponse.steps.map((step) => <li key={step}>{step}</li>)}</ul>
                        <button className="btn response-action" type="button" onClick={dispatchResponse}>
                          {activeResponse.kind === "medical" ? <Siren /> : activeResponse.kind === "monitor" ? <Radar /> : <Send />}
                          <span>{responseSent ? "PACKET SENT" : activeResponse.primaryLabel}</span>
                        </button>
                        {pdfUrl && (
                          <a className="pdf-link" href={pdfUrl} target="_blank" rel="noreferrer">
                            OPEN PDF INCIDENT SUMMARY
                          </a>
                        )}
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="panel panel-right">
          <div className="sub-panel profiles">
            <div className="panel-header"><div className="title amber"><UserSearch /><h2>Identity Access</h2></div></div>
            <div className="panel-body">
              {decrypted ? (
                <div className="profile-card">
                  <strong>{activeCamera.id.toUpperCase()} TEMPORARY REVEAL</strong>
                  <span>Camera: {activeCamera.label}</span>
                  <span>Reason: {revealReason || "Incident response"}</span>
                  <span>Access expires in {Math.max(0, Math.ceil((revealedUntil - Date.now()) / 1000))}s</span>
                  <div className="subject-list">
                    <b>VISIBLE SUBJECTS</b>
                    <em>P-001</em>
                    <em>P-002</em>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <Lock />
                  <p>Identity access locked.<br />Detected faces are covered by black privacy masks.</p>
                </div>
              )}
            </div>
          </div>
          <div className="sub-panel audit">
            <div className="panel-header"><div className="title"><Terminal /><h2>System Audit Log</h2></div><button className="btn" type="button"><Download /> EXPORT</button></div>
            <div className="audit-log">
              {audit.map((entry, index) => (
                <div className={`audit-entry ${entry.kind}`} key={`${entry.time}-${entry.message}-${index}`}>
                  <span>{entry.time}</span>
                  <p>{entry.message}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
