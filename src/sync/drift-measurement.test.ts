import { describe, expect, it } from "vitest";
import {
  createDriftSamples,
  createSlaveDriftSamples,
  summarizeDrift,
} from "./drift-measurement";

describe("drift measurement", () => {
  it("maps global time to expected local time using the frozen offset sign", () => {
    const [sample] = createDriftSamples(250, 12, [
      { id: "camera-a", offsetSeconds: 2, actualLocalTime: 10.25 },
    ]);

    expect(sample.expectedLocalTime).toBe(10);
    expect(sample.errorSeconds).toBeCloseTo(0.25);
  });

  it("excludes the master stream from aggregate drift samples", () => {
    const samples = createSlaveDriftSamples(250, 12, "camera-a", [
      { id: "camera-a", offsetSeconds: 0, actualLocalTime: 12 },
      { id: "camera-b", offsetSeconds: 0, actualLocalTime: 12.03 },
      { id: "camera-c", offsetSeconds: 0, actualLocalTime: 11.98 },
    ]);

    expect(samples.map((sample) => sample.videoId)).toEqual(["camera-b", "camera-c"]);
    expect(summarizeDrift(samples).sampleCount).toBe(2);
  });

  it("summarizes median, p95, and maximum absolute error", () => {
    const samples = [0.01, -0.03, 0.02, -0.08].map((errorSeconds, index) => ({
      sampleTimeMs: index * 250,
      globalTime: index,
      videoId: "camera-a",
      expectedLocalTime: 0,
      actualLocalTime: errorSeconds,
      errorSeconds,
    }));

    const summary = summarizeDrift(samples);
    expect(summary.sampleCount).toBe(4);
    expect(summary.medianAbsoluteError).toBeCloseTo(0.025, 10);
    expect(summary.p95AbsoluteError).toBeCloseTo(0.0725, 10);
    expect(summary.maxAbsoluteError).toBeCloseTo(0.08, 10);
  });

  it("ignores non-finite error values in the summary", () => {
    expect(
      summarizeDrift([
        {
          sampleTimeMs: 0,
          globalTime: 0,
          videoId: "camera-a",
          expectedLocalTime: 0,
          actualLocalTime: Number.NaN,
          errorSeconds: Number.NaN,
        },
      ]),
    ).toMatchObject({ sampleCount: 0, maxAbsoluteError: 0 });
  });
});
