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
  if (participants.length === 0) {
    throw new Error("At least one playback participant is required.");
  }

  for (const { id, controller, targetTime } of participants) {
    if (!Number.isFinite(targetTime)) {
      throw new Error(`Playback target for ${id} must be finite.`);
    }
    const duration = controller.getDuration();
    if (targetTime < 0 || (Number.isFinite(duration) && targetTime > duration)) {
      throw new Error(`Playback target for ${id} is outside the playable media range.`);
    }
  }

  const seekResults = await Promise.allSettled(
    participants.map(async ({ controller, targetTime }) => {
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
