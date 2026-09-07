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

function validatePlaybackParticipants(participants: PlaybackParticipant[]): void {
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
}

async function settleParticipantSeeks(
  participants: PlaybackParticipant[],
  toleranceSeconds?: number,
): Promise<void> {
  const seekResults = await Promise.allSettled(
    participants.map(async ({ controller, targetTime }) => {
      const currentTime = controller.getCurrentTime();
      const needsSeek =
        toleranceSeconds === undefined ||
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
}

export async function seekPlaybackParticipants(
  participants: PlaybackParticipant[],
): Promise<void> {
  validatePlaybackParticipants(participants);
  await settleParticipantSeeks(participants);
}

export async function startSynchronizedPlayback(
  participants: PlaybackParticipant[],
  toleranceSeconds: number,
): Promise<void> {
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
    throw new Error("Playback seek tolerance must be a finite non-negative value.");
  }

  validatePlaybackParticipants(participants);
  await settleParticipantSeeks(participants, toleranceSeconds);

  const playResults = await Promise.allSettled(
    participants.map(({ controller }) => controller.play()),
  );
  if (playResults.some((result) => result.status === "rejected")) {
    participants.forEach(({ controller }) => controller.pause());
    throw failedOperationMessage("play");
  }
}
