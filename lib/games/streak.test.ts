import { describe, expect, it } from "vitest";
import { foldStreaks, localDayKey } from "./streak";

const TODAY = "2026-08-24";

describe("localDayKey", () => {
  it("writes an instant as the day it fell on", () => {
    expect(localDayKey("2026-08-24T15:00:00Z", "UTC")).toBe("2026-08-24");
  });

  it("files a late Chicago evening under that evening, not the next morning", () => {
    // 21:00 Sunday in Chicago is already Monday in UTC. The reader played on
    // Sunday and the streak has to agree with them.
    const iso = "2026-08-24T02:00:00Z";
    expect(localDayKey(iso, "UTC")).toBe("2026-08-24");
    expect(localDayKey(iso, "America/Chicago")).toBe("2026-08-23");
  });

  it("says nothing about a timestamp it cannot read", () => {
    expect(localDayKey("not a date", "UTC")).toBeNull();
  });
});

describe("foldStreaks", () => {
  it("has nothing to report before the first game", () => {
    expect(foldStreaks([], TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it("counts one day played as a streak of one", () => {
    expect(foldStreaks([TODAY], TODAY)).toEqual({ current: 1, longest: 1 });
  });

  it("counts consecutive days", () => {
    const days = ["2026-08-22", "2026-08-23", "2026-08-24"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it("does not count the same day twice", () => {
    const days = ["2026-08-24", "2026-08-24", "2026-08-23"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 2, longest: 2 });
  });

  it("does not care what order the days arrive in", () => {
    const days = ["2026-08-23", "2026-08-21", "2026-08-22"];
    expect(foldStreaks(days, TODAY).longest).toBe(3);
  });

  it("keeps yesterday's streak alive, because today is not over", () => {
    const days = ["2026-08-22", "2026-08-23"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 2, longest: 2 });
  });

  it("lets a streak lapse once a whole day has been missed", () => {
    const days = ["2026-08-21", "2026-08-22"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 0, longest: 2 });
  });

  it("remembers the best run after the current one lapses", () => {
    const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-20"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 0, longest: 4 });
  });

  it("reports the current run even when an older one was longer", () => {
    const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-23", "2026-08-24"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 2, longest: 3 });
  });

  it("counts across the end of a month", () => {
    const days = ["2026-07-30", "2026-07-31", "2026-08-01"];
    expect(foldStreaks(days, "2026-08-01").current).toBe(3);
  });

  it("counts across the end of a year", () => {
    const days = ["2025-12-31", "2026-01-01"];
    expect(foldStreaks(days, "2026-01-01").current).toBe(2);
  });

  it("counts the leap day as a day", () => {
    const days = ["2028-02-28", "2028-02-29", "2028-03-01"];
    expect(foldStreaks(days, "2028-03-01").current).toBe(3);
  });

  it("ignores a day in the future rather than crediting it", () => {
    const days = ["2026-08-24", "2026-09-01"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 1, longest: 1 });
  });

  it("ignores a day it cannot read", () => {
    const days = ["2026-08-24", "yesterday-ish"];
    expect(foldStreaks(days, TODAY)).toEqual({ current: 1, longest: 1 });
  });

  it("reports nothing when it does not know what day it is", () => {
    expect(foldStreaks([TODAY], "unknown")).toEqual({ current: 0, longest: 0 });
  });
});
