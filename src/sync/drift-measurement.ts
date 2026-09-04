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
