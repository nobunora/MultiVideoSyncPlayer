import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { captureCurrentFrame } from "./capture/capture-frame";
import { MeasurementPanel } from "./components/measurement-panel";
import { VideoGrid, type LoadError, type VideoAsset } from "./components/video-grid";
import { HtmlVideoController, type MediaController } from "./media/media-controller";
import { startSynchronizedPlayback } from "./media/synchronized-playback";
import { selectCaptureOutputPath, writePngFile } from "./platform/tauri-capture";
import { inspectLocalMp4Timing, prepareLocalVideoFile, selectLocalVideoPaths } from "./platform/tauri-media";
import {
  applyMeasurementBaseline,
  createMeasurementBaseline,
  DriftRecorder,
  hasSameMeasurementParticipants,
  summarizeDrift,
  type DriftSummary,
  type MeasurementBaseline,
} from "./sync/drift-measurement";

const SAMPLE_INTERVAL_MS = 250;
const MAX_VIDEOS = 4;
const PRE_PLAY_SEEK_TOLERANCE_SECONDS = 0.1;

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
  const mediaControllers = useRef<Record<string, MediaController | null>>({});
  const pendingSeek = useRef<Promise<void> | null>(null);
  const measurementBaseline = useRef<MeasurementBaseline | null>(null);
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
      const paths = (await selectLocalVideoPaths()).slice(0, MAX_VIDEOS - assets.length);
      const prepared = await Promise.all(
        paths.map(async (path) => {
          try {
            const file = await prepareLocalVideoFile(path);
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
              asset.timing = await inspectLocalMp4Timing(file.path);
            } catch (error) {
              asset.timingError = error instanceof Error ? error.message : "Timing metadata is unavailable.";
            }
            return asset;
          } catch (error) {
            const parts = path.split(/[\\/]/);
            return {
              error: error instanceof Error ? error.message : `Could not open ${parts[parts.length - 1] ?? path}.`,
              path,
            };
          }
        }),
      );

      const valid = prepared.filter((result): result is VideoAsset => "id" in result);
      const invalid = prepared.filter((result): result is LoadError => "error" in result);
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
  }, [assets.length]);

  const pauseAll = useCallback(() => {
    Object.values(mediaControllers.current).forEach((controller) => controller?.pause());
    setIsPlaying(false);
  }, []);

  const playAll = useCallback(async () => {
    try {
      if (pendingSeek.current) await pendingSeek.current;
    } catch {
      setIsPlaying(false);
      setMessage("Playback did not start because the previous global seek failed.");
      return;
    }

    let activeBaseline = measurementBaseline.current;
    if (activeBaseline && !hasSameMeasurementParticipants(activeBaseline, assets.map((asset) => asset.id))) {
      measurementBaseline.current = null;
      recorder.current.reset();
      setDriftSummary(recorder.current.summary());
      setIsMeasuring(false);
      setMessage("Measurement baseline reset because the participant set changed.");
      activeBaseline = null;
    }

    const master = assets[0];
    const masterController = master ? mediaControllers.current[master.id] : null;
    if (!masterController) {
      setIsPlaying(false);
      setMessage("Wait until the master video element is ready before synchronized playback.");
      return;
    }
    const masterTime = masterController.getCurrentTime();

    if (activeBaseline && assets.some((asset) => !Number.isFinite(activeBaseline.offsets[asset.id]))) {
      measurementBaseline.current = null;
      recorder.current.reset();
      setDriftSummary(recorder.current.summary());
      setIsMeasuring(false);
      setMessage("Measurement baseline reset because an active participant has no frozen offset.");
      activeBaseline = null;
    }

    const participants = assets.flatMap((asset) => {
      const controller = mediaControllers.current[asset.id];
      if (!controller) return [];
      return [{
        id: asset.id,
        controller,
        targetTime: activeBaseline ? masterTime - activeBaseline.offsets[asset.id] : masterTime,
      }];
    });
    if (participants.length !== assets.length) {
      setIsPlaying(false);
      setMessage("Wait until every loaded video element is ready before synchronized playback.");
      return;
    }

    try {
      await startSynchronizedPlayback(participants, PRE_PLAY_SEEK_TOLERANCE_SECONDS);
      setIsPlaying(true);
      setMessage("Playback started on the local video elements.");
    } catch (error) {
      setIsPlaying(false);
      setMessage(error instanceof Error ? error.message : "Synchronized playback could not start.");
    }
  }, [assets]);

  const seekAll = useCallback((target: number) => {
    setGlobalTime(target);
    if (isMeasuring) {
      measurementBaseline.current = null;
      recorder.current.reset();
      setDriftSummary(recorder.current.summary());
      setIsMeasuring(false);
      setMessage("Measurement stopped and its baseline was reset after a global seek.");
    }

    const previous = pendingSeek.current ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const results = await Promise.allSettled(
        assets.map((asset) => mediaControllers.current[asset.id]?.seek(target)),
      );
      if (results.some((result) => result.status === "rejected")) {
        throw new Error("One or more videos could not complete the global seek.");
      }
    });
    pendingSeek.current = operation;
    void operation.then(
      () => {
        if (pendingSeek.current === operation) pendingSeek.current = null;
      },
      () => {
        if (pendingSeek.current === operation) pendingSeek.current = null;
        setMessage("One or more videos could not complete the global seek.");
      },
    );
  }, [assets, isMeasuring]);

  const capture = useCallback(async (asset: VideoAsset) => {
    const video = videoRefs.current[asset.id];
    if (!video) return;

    try {
      const frame = captureCurrentFrame(video);
      const defaultName = `${asset.fileName.replace(/\.mp4$/i, "")}-frame.png`;
      const path = await selectCaptureOutputPath(defaultName);
      if (!path) return;
      await writePngFile(path, frame.pngBytes);
      setMessage(`Saved ${frame.width}×${frame.height} PNG without changing the source video.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Frame capture failed.");
    }
  }, []);

  const toggleMeasurement = useCallback(() => {
    if (isMeasuring) {
      setIsMeasuring(false);
      setMessage("Drift measurement paused; its starting baseline is preserved.");
      return;
    }

    const ids = assets.map((asset) => asset.id);
    const existingBaseline = measurementBaseline.current;
    const canResume = existingBaseline !== null && hasSameMeasurementParticipants(existingBaseline, ids);
    if (canResume) {
      setIsMeasuring(true);
      setMessage("Drift measurement resumed with its preserved starting baseline.");
      return;
    }

    const master = assets[0];
    const masterController = master ? mediaControllers.current[master.id] : null;
    const global = masterController?.getCurrentTime() ?? Number.NaN;
    const readings = assets.map((asset) => ({
      id: asset.id,
      actualLocalTime: mediaControllers.current[asset.id]?.getCurrentTime() ?? Number.NaN,
    }));
    if (!Number.isFinite(global) || readings.some((reading) => !Number.isFinite(reading.actualLocalTime))) {
      setMessage("Wait until all three video elements have valid playback positions before measuring drift.");
      return;
    }

    measurementBaseline.current = createMeasurementBaseline(global, readings);
    recorder.current.reset();
    setDriftSummary(recorder.current.summary());
    setIsMeasuring(true);
    setMessage("Drift measurement started with a frozen local-time baseline.");
  }, [assets, isMeasuring]);

  useEffect(() => {
    if (!isMeasuring) return;
    const handle = window.setInterval(() => {
      const baseline = measurementBaseline.current;
      const master = assets[0];
      const masterController = master ? mediaControllers.current[master.id] : null;
      if (!baseline || !master || !masterController) return;
      if (!hasSameMeasurementParticipants(baseline, assets.map((asset) => asset.id))) {
        measurementBaseline.current = null;
        recorder.current.reset();
        setDriftSummary(recorder.current.summary());
        setIsMeasuring(false);
        setMessage("Measurement stopped because the participant set changed.");
        return;
      }
      if (masterController.isPaused()) return;

      const global = masterController.getCurrentTime();
      const readings = assets.map((asset) => ({
        id: asset.id,
        actualLocalTime: mediaControllers.current[asset.id]?.getCurrentTime() ?? Number.NaN,
      }));
      const samples = applyMeasurementBaseline(baseline, readings);
      if (!samples) {
        measurementBaseline.current = null;
        recorder.current.reset();
        setDriftSummary(recorder.current.summary());
        setIsMeasuring(false);
        setMessage("Measurement stopped because a participant had no frozen offset.");
        return;
      }
      recorder.current.record(
        samples
          .filter((sample) => Number.isFinite(sample.actualLocalTime))
          .flatMap((sample) => sample.id === master.id ? [] : [{
            sampleTimeMs: performance.now(),
            globalTime: global,
            videoId: sample.id,
            expectedLocalTime: global - sample.offsetSeconds,
            actualLocalTime: sample.actualLocalTime,
            errorSeconds: sample.actualLocalTime - (global - sample.offsetSeconds),
          }]),
      );
      setDriftSummary(recorder.current.summary());
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(handle);
  }, [assets, isMeasuring]);

  const setVideoElement = useCallback((id: string, element: HTMLVideoElement | null) => {
    videoRefs.current[id] = element;
    mediaControllers.current[id] = element ? new HtmlVideoController(element) : null;
  }, []);

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

      <VideoGrid
        assets={assets}
        loadErrors={loadErrors}
        onAddVideos={() => void addVideos()}
        onCapture={(asset) => void capture(asset)}
        onMetadata={(id, metadata) => updateAsset(id, metadata)}
        onTimeUpdate={(id, currentTime) => {
          if (id === assets[0]?.id) setGlobalTime(currentTime);
        }}
        onVideoElement={setVideoElement}
        onVideoError={(id) => updateAsset(id, { playbackError: "WebView2 could not decode this file." })}
        onVideoPause={() => setIsPlaying(false)}
        onVideoPlay={() => setIsPlaying(true)}
      />

      <MeasurementPanel
        isMeasuring={isMeasuring}
        onReset={() => {
          measurementBaseline.current = null;
          recorder.current.reset();
          setDriftSummary(recorder.current.summary());
          setIsMeasuring(false);
        }}
        onToggle={toggleMeasurement}
        sampleIntervalMs={SAMPLE_INTERVAL_MS}
        summary={driftSummary}
        videoCount={assets.length}
      />
    </main>
  );
}

export default App;
