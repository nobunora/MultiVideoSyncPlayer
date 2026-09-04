import { describe, expect, it, vi } from "vitest";
import { captureCurrentFrame } from "./capture-frame";

describe("captureCurrentFrame", () => {
  it("uses the decoded source dimensions rather than displayed CSS size", () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      toDataURL: vi.fn(() => "data:image/png;base64,AAE=") ,
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    const video = { videoWidth: 3840, videoHeight: 2160 } as HTMLVideoElement;

    const result = captureCurrentFrame(video);

    expect(result.width).toBe(3840);
    expect(result.height).toBe(2160);
    expect(canvas.width).toBe(3840);
    expect(canvas.height).toBe(2160);
  });
});
