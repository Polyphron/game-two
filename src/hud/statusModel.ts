export interface StatusModelInput {
  threat?: string;
  contactCount?: number;
  strongestContact?: number;
  missile?: number;
  heat?: number;
  sectorCleared?: number;
}

export interface StatusModel {
  threatLabel: string;
  contactText: string;
  missileText: string;
  heatText: string;
  sectorText: string;
}

const THREAT_LABELS: Record<string, string> = {
  idle: "QUIET",
  quiet: "QUIET",
  contact: "CONTACT",
  suspicious: "SUSPICIOUS",
  investigating: "INVESTIGATING",
  confirmed: "THREAT",
  threat: "THREAT",
  attacking: "ATTACKING",
  searching: "SEARCHING",
  cooling: "COOLING",
  alert: "ALERT",
};

export function buildStatusModel(input: StatusModelInput): StatusModel {
  const contactCount = countValue(input.contactCount);
  const strongestContactPercent = percentText(input.strongestContact);

  return {
    threatLabel: threatLabel(input.threat, contactCount, input.strongestContact ?? 0),
    contactText: `${contactCount} | ${strongestContactPercent}`,
    missileText: `MSL ${percentText(input.missile)}`,
    heatText: `HEAT ${percentText(input.heat)}`,
    sectorText: `SECTOR ${percentText(input.sectorCleared)}`,
  };
}

function threatLabel(threat: string | undefined, contactCount: number, strongestContact: number): string {
  if (threat) {
    const key = threat.trim().toLowerCase();
    return THREAT_LABELS[key] ?? key.replaceAll(/[^a-z0-9]+/g, " ").trim().toUpperCase();
  }

  if (contactCount <= 0 || strongestContact <= 0) {
    return "QUIET";
  }

  if (contactCount >= 3 || strongestContact >= 0.75) {
    return "THREAT";
  }

  return "CONTACT";
}

function percentText(value = 0): string {
  const numeric = Number.isFinite(value) ? value : 0;
  return `${Math.round(clamp(numeric, 0, 1) * 100)}%`;
}

function countValue(value = 0): number {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.floor(numeric));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
