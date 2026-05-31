export type Risk = "critical" | "high" | "medium" | "normal";

export type Camera = {
  id: string;
  label: string;
  file: string;
  src?: string;
  uploaded?: boolean;
  risk: Risk;
  title: string;
  shortDesc: string;
  score: number;
  confidence: number;
  tracks: number;
  hud: string;
  how: string[];
  indicators: string[];
  actions: string[];
};

export const cameras: Camera[] = [
  {
    id: "cam-01",
    label: "MAIN ENTRANCE",
    file: "robbery.mp4",
    risk: "high",
    title: "Street Snatching / Assault",
    shortDesc: "Two suspects approach a walking couple; the victim falls after sudden contact.",
    score: 88,
    confidence: 86,
    tracks: 4,
    hud: "STREET INCIDENT REVIEW",
    how: [
      "A couple walks through a narrow street camera zone.",
      "Two suspects approach from behind and close distance quickly.",
      "A sudden contact incident occurs near the pedestrians.",
      "The victim falls while the suspects move away from the scene.",
      "The sequence is consistent with a street snatching or assault attempt."
    ],
    indicators: ["Two-person suspect approach", "Close-contact incident", "Victim fall / distress reaction", "Immediate suspect departure"],
    actions: [
      "Dispatch nearby patrol or security to the incident location.",
      "Preserve CCTV footage from the full sequence.",
      "Review adjacent street cameras for suspect exit direction.",
      "Record clothing descriptions and movement path.",
      "Check whether the victim requires medical assistance."
    ]
  },
  {
    id: "cam-02",
    label: "RESIDENTIAL ROAD",
    file: "park.mp4",
    risk: "high",
    title: "Chain Snatching / Suspicious Following",
    shortDesc: "Bike-borne suspects slow beside pedestrians before a close-contact theft pattern.",
    score: 91,
    confidence: 89,
    tracks: 4,
    hud: "CHAIN SNATCHING REVIEW",
    how: [
      "A motorcycle with two riders moves close to pedestrians on a residential road.",
      "The riders slow down beside the target rather than passing normally.",
      "A close interaction occurs near the woman walking by the parked cars.",
      "On-screen context indicates a gold-chain snatching incident.",
      "The bike then leaves the contact area, consistent with a drive-by theft."
    ],
    indicators: ["Two riders on motorcycle", "Close roadside approach", "Contact near pedestrian", "Rapid departure after interaction"],
    actions: [
      "Alert local patrol units with motorcycle direction of travel.",
      "Preserve the clip and all adjacent road-camera footage.",
      "Broadcast rider clothing and bike appearance.",
      "Check nearby exits and intersections for continuation footage.",
      "Take victim statement and confirm stolen item details."
    ]
  },
  {
    id: "cam-03",
    label: "PUBLIC PARK",
    file: "video3.mp4",
    risk: "normal",
    title: "Routine Park Activity",
    shortDesc: "People are sitting and walking in a park with no visible threat escalation.",
    score: 14,
    confidence: 93,
    tracks: 4,
    hud: "ROUTINE PUBLIC AREA REVIEW",
    how: [
      "The footage shows a public park or campus lawn.",
      "People are seated in groups while others walk through the area.",
      "Movement remains calm and dispersed across the scene.",
      "No visible confrontation, panic, chase, or theft behavior is observed."
    ],
    indicators: ["Normal pedestrian flow", "Seated public groups", "No close-contact threat pattern", "No crowd panic"],
    actions: ["Continue monitoring.", "No immediate intervention required.", "Keep privacy masking active and retain only routine audit metadata."]
  },
  {
    id: "cam-04",
    label: "HOTEL LOBBY",
    file: "video4.mp4",
    risk: "critical",
    title: "Armed Robbery Attempt",
    shortDesc: "A hooded subject enters a lobby carrying a rifle-shaped weapon and retreats.",
    score: 95,
    confidence: 91,
    tracks: 4,
    hud: "ARMED ROBBERY REVIEW",
    how: [
      "The footage appears to be inside a hotel lobby or front-desk area.",
      "A hooded person enters while carrying what appears to be a long rifle-shaped weapon.",
      "The subject moves toward the service counter area.",
      "The subject then abruptly changes direction and runs away.",
      "The event is consistent with an aborted armed robbery attempt."
    ],
    indicators: ["Armed subject visible", "Direct movement toward counter", "Sudden evasive retreat", "Aborted criminal approach"],
    actions: [
      "Notify law enforcement immediately.",
      "Preserve all interior and entrance camera footage.",
      "Review entry and exit cameras for suspect route.",
      "Share suspect clothing and weapon description with responders.",
      "Check for accomplices or a getaway vehicle outside the premises."
    ]
  },
  {
    id: "cam-05",
    label: "DRIVING TEST ROUTE",
    file: "video5.mp4",
    risk: "medium",
    title: "Driving Test Crash",
    shortDesc: "A learner driver loses control and crashes during a driving test route.",
    score: 62,
    confidence: 88,
    tracks: 4,
    hud: "TRAFFIC INCIDENT REVIEW",
    how: [
      "The footage shows a road/intersection area during a driving-test incident.",
      "A vehicle moves through the scene and loses control near the curb or road edge.",
      "On-screen context indicates a woman crashed her car during a driving test.",
      "The event appears accidental rather than criminal.",
      "The clip suggests road-safety response and medical verification are needed."
    ],
    indicators: ["Vehicle loss of control", "Roadside impact area", "Possible injury context", "Traffic safety hazard"],
    actions: [
      "Dispatch traffic safety or medical assistance if not already present.",
      "Preserve footage for insurance and incident review.",
      "Check whether pedestrians or other vehicles were affected.",
      "Secure the road area and document damage."
    ]
  },
  {
    id: "cam-06",
    label: "APARTMENT DRIVEWAY",
    file: "video8.mp4",
    risk: "normal",
    title: "Pedestrian Street Crossing",
    shortDesc: "A person walks across a residential driveway/road area with no clear threat escalation.",
    score: 21,
    confidence: 82,
    tracks: 0,
    hud: "PEDESTRIAN REVIEW",
    how: [
      "The camera shows a residential driveway or apartment-front road.",
      "One pedestrian crosses the open area while parked cars remain stationary.",
      "No fall, chase, weapon, crowd panic, or vehicle impact is visible in the sampled review.",
      "The scene is best treated as routine movement unless later frames show a new event."
    ],
    indicators: ["Single pedestrian movement", "Parked vehicles", "No visible confrontation", "No emergency response cue"],
    actions: [
      "Continue routine monitoring.",
      "Keep privacy masking enabled if a face is detected.",
      "Do not escalate unless the operator sees a later incident.",
      "Record the clip as no-action review if the scene remains routine."
    ]
  }
];

export const riskLabel = (risk: Risk) => (risk === "medium" ? "WATCH" : risk.toUpperCase());
