// MT: fork-owned overlay widget model and pure helpers.
// Keep this module free of Vue/Electron imports so it can be unit tested and
// reused by the config upgrade path.
import type { Anchor, Widget } from "@/web/overlay/interfaces";

export const MT_COUNTDOWN_TYPE = "mt-countdown";
export const MT_ZONE_TRACKER_TYPE = "mt-zone-tracker";

export const MT_COUNTDOWN_DEFAULT_SECONDS = 300;
export const MT_COUNTDOWN_MIN_SECONDS = 1;
export const MT_COUNTDOWN_MAX_SECONDS = 24 * 60 * 60;

export interface MtCountdownWidget extends Widget {
  anchor: Anchor;
  /** Configured timer length; runtime progress is never persisted. */
  durationSeconds: number;
  showProgressBar: boolean;
}

export interface MtZoneTrackerWidget extends Widget {
  anchor: Anchor;
  showAreaLevel: boolean;
  showPlayerLevel: boolean;
}

/** Clamp an untrusted duration to whole seconds inside the supported range. */
export function clampCountdownSeconds(value: unknown): number {
  let numeric: number;
  if (typeof value === "number") {
    numeric = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    numeric = Number(value);
  } else {
    return MT_COUNTDOWN_DEFAULT_SECONDS;
  }
  if (!Number.isFinite(numeric)) return MT_COUNTDOWN_DEFAULT_SECONDS;
  return Math.min(
    MT_COUNTDOWN_MAX_SECONDS,
    Math.max(MT_COUNTDOWN_MIN_SECONDS, Math.round(numeric)),
  );
}

/** `mm:ss`, or `h:mm:ss` once the remaining time reaches an hour. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(
    0,
    Math.ceil(Number.isFinite(remainingMs) ? remainingMs / 1000 : 0),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 0..1 fraction of the timer that is still left, for the progress bar. */
export function countdownProgress(
  remainingMs: number,
  durationMs: number,
): number {
  if (!Number.isFinite(remainingMs) || !Number.isFinite(durationMs)) return 0;
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, remainingMs / durationMs));
}

/** Area ids come from the log parser; only casing is normalized for display. */
export function displayAreaId(zone: unknown): string {
  if (typeof zone !== "string") return "—";
  const trimmed = zone.trim();
  return trimmed ? trimmed.toUpperCase() : "—";
}

/** Deterministic slot so several new timers do not spawn on top of each other. */
export function countdownAnchor(slot = 0): Anchor {
  return { pos: "tr", x: 97, y: 22 + (Math.max(0, slot) % 6) * 7 };
}

export function createMtCountdownWidget(wmId = 0, slot = 0): MtCountdownWidget {
  return {
    wmId,
    wmType: MT_COUNTDOWN_TYPE,
    wmTitle: "Countdown",
    wmWants: "show",
    wmZorder: null,
    wmFlags: [],
    anchor: countdownAnchor(slot),
    durationSeconds: MT_COUNTDOWN_DEFAULT_SECONDS,
    showProgressBar: true,
  };
}

export function createMtZoneTrackerWidget(wmId = 0): MtZoneTrackerWidget {
  return {
    wmId,
    wmType: MT_ZONE_TRACKER_TYPE,
    wmTitle: "Zone tracker",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: [],
    anchor: { pos: "br", x: 98, y: 72 },
    showAreaLevel: true,
    showPlayerLevel: true,
  };
}

export interface MtWidgetLike {
  wmId?: number;
  wmType?: string;
}

type MtWidgetList = MtWidgetLike[];

/**
 * Single-instance fork widgets are not added by upstream config migrations, so
 * upgraded configs need them inserted explicitly. Idempotent by design.
 */
export function ensureMtSingleWidgets(widgets: MtWidgetList): boolean {
  if (widgets.some((widget) => widget.wmType === MT_ZONE_TRACKER_TYPE)) {
    return false;
  }

  const ids = widgets.map((widget) =>
    typeof widget.wmId === "number" && Number.isFinite(widget.wmId)
      ? widget.wmId
      : 0,
  );
  const nextId = Math.max(0, ...ids) + 1;
  widgets.push(createMtZoneTrackerWidget(nextId));
  return true;
}
