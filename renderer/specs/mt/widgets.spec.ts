import { describe, expect, it } from "vitest";
import {
  MT_COUNTDOWN_DEFAULT_SECONDS,
  MT_COUNTDOWN_MAX_SECONDS,
  MT_COUNTDOWN_TYPE,
  MT_ZONE_TRACKER_TYPE,
  clampCountdownSeconds,
  countdownAnchor,
  countdownProgress,
  createMtCountdownWidget,
  createMtZoneTrackerWidget,
  displayAreaId,
  ensureMtSingleWidgets,
  formatCountdown,
  type MtZoneTrackerWidget,
} from "@/mt/widgets/types";
import { translateMt } from "@/mt/widgets/messages";

describe("mt countdown helpers", () => {
  it("clamps durations to whole supported seconds", () => {
    expect(clampCountdownSeconds(300)).toBe(300);
    expect(clampCountdownSeconds(299.6)).toBe(300);
    expect(clampCountdownSeconds("45")).toBe(45);
    expect(clampCountdownSeconds(0)).toBe(1);
    expect(clampCountdownSeconds(-20)).toBe(1);
    expect(clampCountdownSeconds(MT_COUNTDOWN_MAX_SECONDS + 1)).toBe(
      MT_COUNTDOWN_MAX_SECONDS,
    );
  });

  it("falls back to the default for unusable values", () => {
    expect(clampCountdownSeconds(undefined)).toBe(MT_COUNTDOWN_DEFAULT_SECONDS);
    expect(clampCountdownSeconds(null)).toBe(MT_COUNTDOWN_DEFAULT_SECONDS);
    expect(clampCountdownSeconds("")).toBe(MT_COUNTDOWN_DEFAULT_SECONDS);
    expect(clampCountdownSeconds("abc")).toBe(MT_COUNTDOWN_DEFAULT_SECONDS);
    expect(clampCountdownSeconds(Number.NaN)).toBe(
      MT_COUNTDOWN_DEFAULT_SECONDS,
    );
  });

  it("formats mm:ss and h:mm:ss", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(250)).toBe("00:01");
    expect(formatCountdown(30_000)).toBe("00:30");
    expect(formatCountdown(60_000)).toBe("01:00");
    expect(formatCountdown(3_600_000)).toBe("1:00:00");
    expect(formatCountdown(3_661_000)).toBe("1:01:01");
    expect(formatCountdown(-1)).toBe("00:00");
    expect(formatCountdown(Number.NaN)).toBe("00:00");
  });

  it("keeps progress inside 0..1", () => {
    expect(countdownProgress(1_500, 3_000)).toBe(0.5);
    expect(countdownProgress(-1, 3_000)).toBe(0);
    expect(countdownProgress(4_000, 3_000)).toBe(1);
    expect(countdownProgress(1, 0)).toBe(0);
    expect(countdownProgress(Number.NaN, 3_000)).toBe(0);
  });

  it("normalizes area ids for display without inventing names", () => {
    expect(displayAreaId("g1_1")).toBe("G1_1");
    expect(displayAreaId("  g2_4 ")).toBe("G2_4");
    expect(displayAreaId("")).toBe("—");
    expect(displayAreaId(null)).toBe("—");
  });
});

describe("mt widget factories", () => {
  it("builds countdown instances with staggered anchors", () => {
    const widget = createMtCountdownWidget(7, 1);
    expect(widget).toMatchObject({
      wmId: 7,
      wmType: MT_COUNTDOWN_TYPE,
      wmWants: "show",
      durationSeconds: MT_COUNTDOWN_DEFAULT_SECONDS,
      showProgressBar: true,
    });
    expect(widget.anchor).toEqual(countdownAnchor(1));
    expect(countdownAnchor(1).y).toBeGreaterThan(countdownAnchor(0).y);
    expect(countdownAnchor(6)).toEqual(countdownAnchor(0));
  });

  it("builds a hidden single zone tracker", () => {
    expect(createMtZoneTrackerWidget(3)).toMatchObject({
      wmId: 3,
      wmType: MT_ZONE_TRACKER_TYPE,
      wmWants: "hide",
      showAreaLevel: true,
      showPlayerLevel: true,
    });
  });
});

describe("ensureMtSingleWidgets", () => {
  it("inserts the zone tracker once with the next widget id", () => {
    const widgets = [
      { wmId: 2, wmType: "menu" },
      { wmId: 5, wmType: "settings" },
    ];

    expect(ensureMtSingleWidgets(widgets)).toBe(true);
    expect(widgets).toHaveLength(3);

    const added = widgets[2] as MtZoneTrackerWidget;
    expect(added.wmId).toBe(6);
    expect(added.wmType).toBe(MT_ZONE_TRACKER_TYPE);

    expect(ensureMtSingleWidgets(widgets)).toBe(false);
    expect(widgets).toHaveLength(3);
  });

  it("does not touch a config that already has the tracker", () => {
    const widgets = [
      { wmId: 1, wmType: "menu" },
      { wmId: 9, wmType: MT_ZONE_TRACKER_TYPE },
    ];

    expect(ensureMtSingleWidgets(widgets)).toBe(false);
    expect(widgets).toHaveLength(2);
  });
});

describe("mt overlay messages", () => {
  it("translates EN and PL strings", () => {
    expect(translateMt("en", "overlay.countdown.finished")).toBe("Finished");
    expect(translateMt("pl", "overlay.countdown.finished")).toBe("Koniec");
  });

  it("interpolates placeholders", () => {
    expect(
      translateMt("en", "overlay.zone.areaLevelShort", { level: 12 }),
    ).toBe("lvl 12");
    expect(
      translateMt("pl", "overlay.zone.areaLevelShort", { level: 12 }),
    ).toBe("poz. 12");
    expect(translateMt("en", "overlay.zone.areaLevelShort")).toBe(
      "lvl {level}",
    );
  });

  it("returns the key for unknown messages", () => {
    expect(translateMt("en", "overlay.missing.key")).toBe(
      "overlay.missing.key",
    );
  });
});
