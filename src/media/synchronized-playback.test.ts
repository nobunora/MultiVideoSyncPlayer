import { describe, expect, it } from "vitest";
import { startSynchronizedPlayback } from "./synchronized-playback";
import type { MediaController } from "./media-controller";

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function fakeController(currentTime: number, seekOperation: Promise<void>): MediaController & {
  playCalls: number;
  pauseCalls: number;
  seekTargets: number[];
} {
  const state = {
    playCalls: 0,
    pauseCalls: 0,
    seekTargets: [] as number[],
  };

  return {
    getCurrentTime: () => currentTime,
    getDuration: () => 30,
    seek: (targetTime) => {
      state.seekTargets.push(targetTime);
      return seekOperation;
    },
    play: () => {
      state.playCalls += 1;
      return Promise.resolve();
    },
    pause: () => {
      state.pauseCalls += 1;
    },
    isPaused: () => true,
    get playCalls() {
      return state.playCalls;
    },
    get pauseCalls() {
      return state.pauseCalls;
    },
    get seekTargets() {
      return state.seekTargets;
    },
  };
}

describe("synchronized playback", () => {
  it("uses the frozen per-participant local targets instead of normalizing slaves to the master time", async () => {
    const master = fakeController(11.5, Promise.resolve());
    const slaveB = fakeController(10.0, Promise.resolve());
    const slaveC = fakeController(10.75, Promise.resolve());

    await startSynchronizedPlayback(
      [
        { id: "camera-a", controller: master, targetTime: 12 },
        { id: "camera-b", controller: slaveB, targetTime: 10.5 },
        { id: "camera-c", controller: slaveC, targetTime: 11.25 },
      ],
      0.1,
    );

    expect(master.seekTargets).toEqual([12]);
    expect(slaveB.seekTargets).toEqual([10.5]);
    expect(slaveC.seekTargets).toEqual([11.25]);
    expect([master.playCalls, slaveB.playCalls, slaveC.playCalls]).toEqual([1, 1, 1]);
  });

  it("does not play any controller before every required seek settles", async () => {
    const firstSeek = deferred();
    const secondSeek = deferred();
    const first = fakeController(0, firstSeek.promise);
    const second = fakeController(4, secondSeek.promise);
    const playback = startSynchronizedPlayback(
      [
        { id: "camera-a", controller: first, targetTime: 5 },
        { id: "camera-b", controller: second, targetTime: 5 },
      ],
      0.1,
    );

    await Promise.resolve();
    expect(first.playCalls).toBe(0);
    expect(second.playCalls).toBe(0);

    firstSeek.resolve();
    await Promise.resolve();
    expect(first.playCalls).toBe(0);
    expect(second.playCalls).toBe(0);

    secondSeek.resolve();
    await playback;
    expect(first.playCalls).toBe(1);
    expect(second.playCalls).toBe(1);
  });

  it("does not start playback when a pre-play seek fails", async () => {
    const failedSeek = Promise.reject(new Error("seek failed"));
    const first = fakeController(0, failedSeek);
    const second = fakeController(5, Promise.resolve());

    await expect(
      startSynchronizedPlayback(
        [
          { id: "camera-a", controller: first, targetTime: 5 },
          { id: "camera-b", controller: second, targetTime: 5 },
        ],
        0.1,
      ),
    ).rejects.toThrow("could not seek");
    expect(first.playCalls).toBe(0);
    expect(second.playCalls).toBe(0);
  });

  it("pauses all participants when one play operation fails", async () => {
    const first: MediaController & { pauseCalls: number } = {
      getCurrentTime: () => 5,
      getDuration: () => 30,
      seek: () => Promise.resolve(),
      play: () => Promise.resolve(),
      pauseCalls: 0,
      pause() {
        this.pauseCalls += 1;
      },
      isPaused: () => false,
    };
    const second: MediaController & { pauseCalls: number } = {
      getCurrentTime: () => 5,
      getDuration: () => 30,
      seek: () => Promise.resolve(),
      play: () => Promise.reject(new Error("play failed")),
      pauseCalls: 0,
      pause() {
        this.pauseCalls += 1;
      },
      isPaused: () => false,
    };

    await expect(
      startSynchronizedPlayback(
        [
          { id: "camera-a", controller: first, targetTime: 5 },
          { id: "camera-b", controller: second, targetTime: 5 },
        ],
        0.1,
      ),
    ).rejects.toThrow("rolled back");
    expect(first.pauseCalls).toBe(1);
    expect(second.pauseCalls).toBe(1);
  });

  it("rejects an invalid seek tolerance before any media operation", async () => {
    const controller = fakeController(0, Promise.resolve());

    await expect(
      startSynchronizedPlayback(
        [{ id: "camera-a", controller, targetTime: 1 }],
        -0.1,
      ),
    ).rejects.toThrow("finite non-negative");
    expect(controller.seekTargets).toEqual([]);
    expect(controller.playCalls).toBe(0);
  });
});
