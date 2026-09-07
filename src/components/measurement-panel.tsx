import type { DriftSummary } from "../sync/drift-measurement";

interface MeasurementPanelProps {
  hasBaseline: boolean;
  isMeasuring: boolean;
  onReset: () => void;
  onToggle: () => void;
  sampleIntervalMs: number;
  summary: DriftSummary;
  videoCount: number;
}

function formatSeconds(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(3)} s` : "—";
}

export function MeasurementPanel({
  hasBaseline,
  isMeasuring,
  onReset,
  onToggle,
  sampleIntervalMs,
  summary,
  videoCount,
}: MeasurementPanelProps) {
  const toggleLabel = isMeasuring
    ? "Pause measurement"
    : hasBaseline
      ? "Resume measurement"
      : "Start measurement";

  return (
    <section className="measurement-panel" aria-label="Drift measurement">
      <div>
        <p className="eyebrow">PHASE 0 SPIKE</p>
        <h2>Three-video drift measurement</h2>
        <p>Samples every {sampleIntervalMs} ms against Camera 1 as the master. Aggregate statistics include slave streams only.</p>
      </div>
      <div className="measurement-actions">
        <button type="button" onClick={onToggle} disabled={videoCount < 3}>
          {toggleLabel}
        </button>
        <button type="button" onClick={onReset} disabled={!hasBaseline}>Reset</button>
      </div>
      <dl className="metrics">
        <div><dt>Samples</dt><dd>{summary.sampleCount}</dd></div>
        <div><dt>Median |error|</dt><dd>{formatSeconds(summary.medianAbsoluteError)}</dd></div>
        <div><dt>P95 |error|</dt><dd>{formatSeconds(summary.p95AbsoluteError)}</dd></div>
        <div><dt>Max |error|</dt><dd>{formatSeconds(summary.maxAbsoluteError)}</dd></div>
      </dl>
    </section>
  );
}
