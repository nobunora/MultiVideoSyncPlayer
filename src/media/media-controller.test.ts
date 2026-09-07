import { describe, expect, it } from "vitest";
import { HtmlVideoController } from "./media-controller";

describe("HtmlVideoController", () => {
  it("waits for seeked when the target time is already current but seeking is active", async () => {
    let currentTime = 2;
    let seeking = true;
    const video = new EventTarget() as HTMLVideoElement;
    Object.defineProperties(video, {
      currentTime: {
        configurable: true,
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
        },
      },
      duration: { configurable: true, value: 10 },
      seeking: { configurable: true, get: () => seeking },
    });

    const seek = new HtmlVideoController(video).seek(2);
    let settled = false;
    void seek.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    seeking = false;
    video.dispatchEvent(new Event("seeked"));
    await seek;
    expect(settled).toBe(true);
  });

  it("rejects a negative seek instead of clamping it to zero", async () => {
    const video = new EventTarget() as HTMLVideoElement;
    Object.defineProperties(video, {
      currentTime: { configurable: true, value: 0, writable: true },
      duration: { configurable: true, value: 10 },
      seeking: { configurable: true, value: false },
    });

    await expect(new HtmlVideoController(video).seek(-0.01)).rejects.toThrow("outside the playable media range");
    expect(video.currentTime).toBe(0);
  });

  it("rejects a seek beyond a finite duration instead of clamping it to the end", async () => {
    const video = new EventTarget() as HTMLVideoElement;
    Object.defineProperties(video, {
      currentTime: { configurable: true, value: 5, writable: true },
      duration: { configurable: true, value: 10 },
      seeking: { configurable: true, value: false },
    });

    await expect(new HtmlVideoController(video).seek(10.01)).rejects.toThrow("outside the playable media range");
    expect(video.currentTime).toBe(5);
  });
});
