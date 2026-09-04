import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { captureCurrentFrame } from "./capture/capture-frame";
import {
  chooseCapturePath,
  inspectMp4Timing,
  prepareVideoFile,
  selectVideoPaths,
  writeCapturePng,
  type Mp4TimingInfo,
  type PreparedVideoFile,
} from "./media/local-file";
import { createDriftSamples, DriftRecorder, summarizeDrift, type DriftSummary } from "./sync/drift-measurement";

interface VideoAsset extends PreparedVideoFile {
  id: string;
  duration: number;
  width: number;
  height: number;
  timing: Mp4TimingInfo | null;
  timingError: string | null;
  playbackError: string | null;
}

interface LoadError {
  path: string;
  error: string;
}

const SAMPLE_INTERVAL_MS = 250;
const MAX_VIDEOS = 4;

function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function formatSeconds(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(3)} s` : "—";
}

function App() {
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [loadErrors, setLoadErrors] = useState<LoadError[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [driftSummary, setDriftSummary] = useState<DriftSummary>(() => summarizeDrift([]));
  const [message, setMessage] = useState("Ready for local MP4 files.");
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const recorder = useRef(new DriftRecorder());

  const maxDuration = useMemo(
    () => assets.reduce((maximum, asset) => Math.max(maximum, asset.duration), 0),
    [assets],
  );

  const updateAsset = useCallback((id: string, update: Partial<VideoAsset>) => {
    setAssets((current) => current.map((asset) => (asset.id === id ? { ...asset, ...update } : asset)));
  }, []);

  const addVideos = useCallback(async () => {
    if (assets.length >= MAX_VIDEOS) {
      setMessage(`The foundation currently supports up to ${MAX_VIDEOS} videos.`);
      return;
    }

    try {
      const paths = (await selectVideoPaths()).slice(0, MAX_VIDEOS - assets.length);
      const prepared = await Promise.all(
        paths.map(async (path) => {
          try {
            const file = await prepareVideoFile(path);
            const asset: VideoAsset = {
              ...file,
              id: crypto.randomUUID(),
              duration: 0,
              width: 0,
              height: 0,
              timing: null,
              timingError: null,
              playbackError: null,
            };

            try {
              asset.timing = await inspectMp4Timing(file.path);
            } catch (error) {
              asset.timingError = error instanceof Error ? error.message : "Timing metadata is unavailable.";
            }
            return asset;
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : `Could not open ${fileNameFromPath(path)}.`,
              path,
            };
          }
        }),
      );

      const valid = prepared.filter((result): result is VideoAsset => "id" in result);
      const invalid = prepared.filter((result): result is { error: string; path: string } => "error" in result);
      setAssets((current) => [...current, ...valid]);
      setLoadErrors((current) => [...current, ...invalid]);
      setMessage(
        invalid.length > 0
          ? `${valid.length} file(s) loaded; ${invalid.length} file(s) failed independently.`
          : valid.length > 0
            ? `${valid.length} local file(s) added without copying the source.`
            : "No files selected.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The native file picker failed.");
    }
  }, [assets.length, updateAsset]);

  const pauseAll = useCallback(() => {
    Object.values(videoRefs.current).forEach((video) => video?.pause());
    setIsPlaying(false);
  }, []);

  const playAll = useCallback(async () => {
    const masterTime = videoRefs.current[assets[0]?.id ?? ""]?.currentTime ?? globalTime;
    const results = await Promise.allSettled(
      assets.map(async (asset) => {
        const video = videoRefs.current[asset.id];
        if (!video) return;
        if (Math.abs(video.currentTime - masterTime) > 0.1) video.currentTime = masterTime;
        await video.play();
      }),
    );
    const rejected = results.filter((result) => result.status === "rejected");
    setIsPlaying(rejected.length === 0 && assets.length > 0);
    setMessage(rejected.length === 0 ? "Playback started on the local video elements." : "One or more videos could not play.");
  }, [assets, globalTime]);

  const seekAll = useCallback((target: number) => {
    setGlobalTime(target);
    assets.forEach((asset) => {
      const video = videoRefs.current[asset.id];
      if (video) video.currentTime = Math.min(target, video.duration || target);
    });
  }, [assets]);

  const capture = useCallback(async (asset: VideoAsset) => {
    const video = videoRefs.current[asset.id];
    if (!video) return;

    try {
      const frame = captureCurrentFrame(video);
      const defaultName = `${asset.fileName.replace(/\.mp4$/i, "")}-frame.png`;
      const path = await chooseCapturePath(defaultName);
      if (!path) return;
      await writeCapturePng(path, frame.pngBytes);
      setMessage(`Saved ${frame.width}×${frame.height} PNG without changing the source video.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Frame capture failed.");
    }
  }, []);

  useEffect(() => {
    if (!isMeasuring) return;
    const handle = window.setInterval(() => {
      const master = assets[0];
      const masterVideo = master ? videoRefs.current[master.id] : null;
      if (!masterVideo) return;
      const samples = createDriftSamples(
        performance.now(),
        masterVideo.currentTime,
        assets.map((asset) => ({
          id: asset.id,
          offsetSeconds: 0,
          actualLocalTime: videoRefs.current[asset.id]?.currentTime ?? Number.NaN,
        })),
      );
      recorder.current.record(samples);
      setDriftSummary(recorder.current.summary());
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(handle);
  }, [assets, isMeasuring]);

  const resetMeasurement = () => {
    recorder.current.reset();
    setDriftSummary(recorder.current.summary());
    setIsMeasuring(false);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">LOCAL-FIRST VIDEO REVIEW</p>
          <h1>MultiVideoSyncPlayer</h1>
          <p className="subtitle">Foundation cut · direct local MP4 playback</p>
        </div>
        <div className="local-badge" aria-label="Local only runtime">LOCAL ONLY</div>
      </header>

      <section className="toolbar" aria-label="Playback controls">
        <button className="primary" type="button" onClick={() => void addVideos()}>Open MP4 files</button>
        <button type="button" onClick={() => void playAll()} disabled={assets.length === 0 || isPlaying}>Play all</button>
        <button type="button" onClick={pauseAll} disabled={assets.length === 0 || !isPlaying}>Pause all</button>
        <label className="timeline-control">
          <span>Global time {formatSeconds(globalTime)}</span>
          <input
            type="range"
            min="0"
            max={maxDuration || 1}
            step="0.001"
            value={Math.min(globalTime, maxDuration || 1)}
            onChange={(event) => seekAll(Number(event.currentTarget.value))}
            disabled={assets.length === 0}
          />
        </label>
      </section>

      <p className="status" role="status">{message}</p>

      {loadErrors.length > 0 && (
        <section className="load-errors" aria-label="Files that could not be loaded">
          <strong>Files not loaded</strong>
          {loadErrors.map((loadError) => (
            <p key={`${loadError.path}-${loadError.error}`}><span>{fileNameFromPath(loadError.path)}</span> — {loadError.error}</p>
          ))}
        </section>
      )}

      <section className={`video-grid count-${Math.max(1, Math.min(4, assets.length))}`} aria-label="Video panes">
        {assets.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">＋</span>
            <h2>Select up to four local MP4 files</h2>
            <p>The source path is retained and authorized narrowly for this session. No full-file import is performed.</p>
            <button className="primary" type="button" onClick={() => void addVideos()}>Choose local files</button>
          </div>
        ) : (
          assets.map((asset, index) => (
            <article className="video-card" key={asset.id}>
              <div className="video-card-header">
                <div>
                  <span className="camera-label">CAMERA {index + 1}</span>
                  <h2 title={asset.path}>{asset.fileName}</h2>
                </div>
                <span className="file-state">DIRECT FILE</span>
              </div>
              <video
                ref={(element) => { videoRefs.current[asset.id] = element; }}
                src={asset.sourceUrl}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  updateAsset(asset.id, { duration: video.duration, width: video.videoWidth, height: video.videoHeight });
                }}
                onTimeUpdate={(event) => {
                  if (asset.id === assets[0]?.id) setGlobalTime(event.currentTarget.currentTime);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={() => updateAsset(asset.id, { playbackError: "WebView2 could not decode this file." })}
              />
              <div className="metadata">
                <span>{asset.width > 0 ? `${asset.width}×${asset.height}` : "Reading dimensions…"}</span>
                <span>{formatSeconds(asset.duration)}</span>
                <span>{asset.timing?.cfr ? `${asset.timing.frameDurationSeconds?.toFixed(4)} s/frame CFR` : asset.timingError ? "Timing unknown" : "Reading timing…"}</span>
              </div>
              {asset.playbackError && <p className="error">{asset.playbackError}</p>}
              {asset.timingError && <p className="warning">Playable status is independent; exact timing is unavailable for this file.</p>}
              <button type="button" onClick={() => void capture(asset)} disabled={asset.width === 0}>Capture native PNG</button>
            </article>
          ))
        )}
      </section>

      <section className="measurement-panel" aria-label="Drift measurement">
        <div>
          <p className="eyebrow">PHASE 0 SPIKE</p>
          <h2>Three-video drift measurement</h2>
          <p>Samples every {SAMPLE_INTERVAL_MS} ms against Camera 1 as the master. Use play, pause/resume, and the timeline seek while recording.</p>
        </div>
        <div className="measurement-actions">
          <button type="button" onClick={() => setIsMeasuring((current) => !current)} disabled={assets.length < 3}>
            {isMeasuring ? "Stop measurement" : "Start measurement"}
          </button>
          <button type="button" onClick={resetMeasurement} disabled={driftSummary.sampleCount === 0}>Reset</button>
        </div>
        <dl className="metrics">
          <div><dt>Samples</dt><dd>{driftSummary.sampleCount}</dd></div>
          <div><dt>Median |error|</dt><dd>{formatSeconds(driftSummary.medianAbsoluteError)}</dd></div>
          <div><dt>P95 |error|</dt><dd>{formatSeconds(driftSummary.p95AbsoluteError)}</dd></div>
          <div><dt>Max |error|</dt><dd>{formatSeconds(driftSummary.maxAbsoluteError)}</dd></div>
        </dl>
      </section>
    </main>
  );
}

export default App;
