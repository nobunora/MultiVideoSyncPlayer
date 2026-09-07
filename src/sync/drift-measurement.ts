export interface DriftSample {
  sampleTimeMs: number;
  globalTime: number;
  videoId: string;
  expectedLocalTime: number;
  actualLocalTime: number;
  errorSeconds: number;
}

export interface DriftSummary {
  sampleCount: number;
  medianAbsoluteError: number;
  p95AbsoluteError: number;
  maxAbsoluteError: number;
}

export interface MeasurementVideo {
  id: string;
  offsetSeconds: number;
  actualLocalTime: number;
}

export interface MeasurementReading {
  id: string;
  actualLocalTime: number;
}

export interface MeasurementBaseline {
  globalTime: number;
  videoIds: string[];
  offsets: Record<string, number>;
}

export interface MeasurementDuration {
  id: string;
  duration: number;
}

export interface GlobalTimeRange {
  min: number;
  max: number;
}

export function createMeasurementBaseline(
  globalTime: number,
  readings: MeasurementReading[],
): MeasurementBaseline {
  return {
    globalTime,
    videoIds: readings.map((reading) => reading.id),
    offsets: Object.fromEntries(
      readings.map((reading) => [reading.id, globalTime - reading.actualLocalTime]),
    ),
  };
}

export function hasSameMeasurementParticipants(
  baseline: MeasurementBaseline,
  participantIds: string[],
): boolean {
  return baseline.videoIds.length === participantIds.length &&
    baseline.videoIds.every((id, index) => id === participantIds[index]);
}

export function mapGlobalTimeToMeasurementTargets(
  baseline: MeasurementBaseline,
  participantIds: string[],
  globalTime: number,
): Record<string, number> | null {
  if (!Number.isFinite(globalTime) || !hasSameMeasurementParticipants(baseline, participantIds)) {
    return null;
  }

  const targets: Record<string, number> = {};
  for (const id of participantIds) {
    const offsetSeconds = baseline.offsets[id];
    if (!Number.isFinite(offsetSeconds)) return null;
    const targetTime = globalTime - offsetSeconds;
    if (!Number.isFinite(targetTime)) return null;
    targets[id] = targetTime;
  }
  return targets;
}

export function getMeasurementGlobalTimeRange(
  baseline: MeasurementBaseline,
  videos: MeasurementDuration[],
): GlobalTimeRange | null {
  const participantIds = videos.map((video) => video.id);
  if (!hasSameMeasurementParticipants(baseline, participantIds) || videos.length === 0) {
    return null;
  }

  let min = Number.NEGATIVE_INFINITY;
  let max = Number.POSITIVE_INFINITY;
  for (const video of videos) {
    const offsetSeconds = baseline.offsets[video.id];
    if (!Number.isFinite(offsetSeconds) || !Number.isFinite(video.duration) || video.duration <= 0) {
      return null;
    }
    min = Math.max(min, offsetSeconds);
    max = Math.min(max, offsetSeconds + video.duration);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return { min, max };
}

export function applyMeasurementBaseline(
  baseline: MeasurementBaseline,
  readings: MeasurementReading[],
): MeasurementVideo[] | null {
  if (!hasSameMeasurementParticipants(baseline, readings.map((reading) => reading.id))) {
    return null;
  }

  const videos: MeasurementVideo[] = [];
  for (const reading of readings) {
    const offsetSeconds = baseline.offsets[reading.id];
    if (!Number.isFinite(offsetSeconds)) return null;
    videos.push({ ...reading, offsetSeconds });
  }
  return videos;
}

export function createDriftSamples(
  sampleTimeMs: number,
  globalTime: number,
  videos: MeasurementVideo[],
): DriftSample[] {
  return videos.map((video) => {
    const expectedLocalTime = globalTime - video.offsetSeconds;
    return {
      sampleTimeMs,
      globalTime,
      videoId: video.id,
      expectedLocalTime,
      actualLocalTime: video.actualLocalTime,
      errorSeconds: video.actualLocalTime - expectedLocalTime,
    };
  });
}

export function createSlaveDriftSamples(
  sampleTimeMs: number,
  globalTime: number,
  masterVideoId: string,
  videos: MeasurementVideo[],
): DriftSample[] {
  return createDriftSamples(
    sampleTimeMs,
    globalTime,
    videos.filter((video) => video.id !== masterVideoId),
  );
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

export function summarizeDrift(samples: DriftSample[]): DriftSummary {
  const absoluteErrors = samples
    .map((sample) => Math.abs(sample.errorSeconds))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  return {
    sampleCount: absoluteErrors.length,
    medianAbsoluteError: percentile(absoluteErrors, 0.5),
    p95AbsoluteError: percentile(absoluteErrors, 0.95),
    maxAbsoluteError: absoluteErrors[absoluteErrors.length - 1] ?? 0,
  };
}

export class DriftRecorder {
  private readonly samples: DriftSample[] = [];

  record(sample: DriftSample | DriftSample[]): void {
    this.samples.push(...(Array.isArray(sample) ? sample : [sample]));
  }

  reset(): void {
    this.samples.length = 0;
  }

  getSamples(): DriftSample[] {
    return [...this.samples];
  }

  summary(): DriftSummary {
    return summarizeDrift(this.samples);
  }
}
