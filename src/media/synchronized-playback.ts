import type { MediaController } from "./media-controller";

export interface PlaybackParticipant {
  id: string;
  controller: MediaController;
  targetTime: number;
}

function failedOperationMessage(operation: "seek" | "play"): Error {
  return new Error(
    operation === "seek"
      ? "One or more videos could not seek to the assigned playback time."
      : "One or more videos could not start; playback was rolled back.",
  );
}

export async function startSynchronizedPlayback(
  participants: PlaybackParticipant[],
  toleranceSeconds: number,
): Promise<void> {
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
    throw new Error("Playback seek tolerance must be a finite non-negative value.");
  }

  const seekResults = await Promise.allSettled(
    participants.map(async ({ controller, targetTime }) => {
      if (!Number.isFinite(targetTime)) {
        throw new Error("Playback target must be finite.");
      }
      const currentTime = controller.getCurrentTime();
      const needsSeek =
        !Number.isFinite(currentTime) ||
        Math.abs(currentTime - targetTime) > toleranceSeconds ||
        controller.isSeeking?.() === true;

      if (needsSeek) {
        await controller.seek(targetTime);
      }
    }),
  );

  if (seekResults.some((result) => result.status === "rejected")) {
    throw failedOperationMessage("seek");
  }

  const playResults = await Promise.allSettled(
    participants.map(({ controller }) => controller.play()),
  );
  if (playResults.some((result) => result.status === "rejected")) {
    participants.forEach(({ controller }) => controller.pause());
    throw failedOperationMessage("play");
  }
}
