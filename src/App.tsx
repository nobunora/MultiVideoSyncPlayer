import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { captureCurrentFrame } from "./capture/capture-frame";
import { MeasurementPanel } from "./components/measurement-panel";
import { VideoGrid, type LoadError, type VideoAsset } from "./components/video-grid";
import { HtmlVideoController, type MediaController } from "./media/media-controller";
import {
  seekPlaybackParticipants,
  startSynchronizedPlayback,
} from "./media/synchronized-playback";
import { selectCaptureOutputPath, writePngFile } from "./platform/tauri-capture";
import { inspectLocalMp4Timing, prepareLocalVideoFile, selectLocalVideoPaths } from "./platform/tauri-media";
import {
  applyMeasurementBaseline,
  createMeasurementBaseline,
  createSlaveDriftSamples,
  DriftRecorder,
  hasSameMeasurementParticipants,
  mapGlobalTimeToMeasurementTargets,
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
  const [hasMeasurementBaseline, setHasMeasurementBaseline] = useState(false);
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

  const clearMeasurement = useCallback((statusMessage?: string) => {
    measurementBaseline.current = null;
    recorder.current.reset();
    setDriftSummary(recorder.current.summary());
    setIsMeasuring(false);
    setHasMeasurementBaseline(false);
    if (statusMessage) setMessage(statusMessage);
  }, []);

  const addVideos = useCallback(async () => {
    if (pendingSeek.current) {
      setMessage("Wait for the current global seek to finish before changing the video set.");
      return;
    }
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
      if (valid.length > 0) {
        Object.values(mediaControllers.current).forEach((controller) => controller?.pause());
        setIsPlaying(false);
        if (measurementBaseline.current !== null) clearMeasurement();
      }
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
  }, [assets.length, clearMeasurement]);

  const pauseAll = useCallback(() => {
    Object.values(mediaControllers.current).forEach((controller) => controller?.pause());
    setIsPlaying(false);
  }, []);

  const refreshPlaybackState = useCallback(() => {
    const readyControllers = assets.flatMap((asset) => {
      const controller = mediaControllers.current[asset.id];
      return controller ? [controller] : [];
    });
    setIsPlaying(
      assets.length > 0 &&
      readyControllers.length === assets.length &&
      readyControllers.every((controller) => !controller.isPaused()),
    );
  }, [assets]);

  useEffect(() => {
    refreshPlaybackState();
  }, [refreshPlaybackState]);

  const playAll = useCallback(async () => {
    try {
      if (pendingSeek.current) await pendingSeek.current;
    } catch {
      setIsPlaying(false);
      setMessage("Playback did not start because the previous global seek failed.");
      return;
    }

    let activeBaseline = measurementBaseline.current;
    const participantIds = assets.map((asset) => asset.id);
    if (activeBaseline && !hasSameMeasurementParticipants(activeBaseline, participantIds)) {
      clearMeasurement("Measurement baseline reset because the participant set changed.");
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

    const mappedTargets = activeBaseline
      ? mapGlobalTimeToMeasurementTargets(activeBaseline, participantIds, masterTime)
      : null;
    if (activeBaseline && !mappedTargets) {
      clearMeasurement("Measurement baseline reset because its frozen offsets are invalid.");
      setIsPlaying(false);
      return;
    }

    const participants = assets.flatMap((asset) => {
      const controller = mediaControllers.current[asset.id];
      if (!controller) return [];
      return [{
        id: asset.id,
        controller,
        targetTime: mappedTargets?.[asset.id] ?? masterTime,
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
  }, [assets, clearMeasurement]);

  const seekAll = useCallback((target: number) => {
    const participantIds = assets.map((asset) => asset.id);
    let activeBaseline = measurementBaseline.current;
    if (activeBaseline && !hasSameMeasurementParticipants(activeBaseline, participantIds)) {
      clearMeasurement("Measurement baseline reset because the participant set changed.");
      activeBaseline = null;
    }

    const mappedTargets = activeBaseline
      ? mapGlobalTimeToMeasurementTargets(activeBaseline, participantIds, target)
      : null;
    if (activeBaseline && !mappedTargets) {
      clearMeasurement("Measurement baseline reset because its frozen offsets are invalid.");
      return;
    }

    const participants = assets.flatMap((asset) => {
      const controller = mediaControllers.current[asset.id];
      if (!controller) return [];
      return [{
        id: asset.id,
        controller,
        targetTime: mappedTargets?.[asset.id] ?? target,
      }];
    });
    if (participants.length !== assets.length) {
      setMessage("Wait until every loaded video element is ready before a global seek.");
      return;
    }

    if (activeBaseline && isMeasuring) {
      setIsMeasuring(false);
      setMessage("Global seek started; drift measurement paused while the current camera alignment is preserved.");
    }

    const previous = pendingSeek.current ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(() => seekPlaybackParticipants(participants));
    pendingSeek.current = operation;
    void operation.then(
      () => {
        if (pendingSeek.current === operation) pendingSeek.current = null;
        setGlobalTime(target);
        setMessage(
          activeBaseline
            ? "Global seek completed with the current camera alignment preserved."
            : "Global seek completed.",
        );
      },
      () => {
        if (pendingSeek.current === operation) pendingSeek.current = null;
        setMessage("One or more videos could not complete the global seek.");
      },
    );
  }, [assets, clearMeasurement, isMeasuring]);

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

    if (pendingSeek.current) {
      setMessage("Wait for the current global seek to finish before starting or resuming drift measurement.");
      return;
    }

    const controllers = assets.flatMap((asset) => {
      const controller = mediaControllers.current[asset.id];
      return controller ? [controller] : [];
    });
    if (controllers.length !== assets.length) {
      setMessage("Wait until every loaded video element is ready before measuring drift.");
      return;
    }
    if (controllers.some((controller) => controller.isSeeking?.() === true)) {
      setMessage("Wait until all video seeks have settled before starting or resuming drift measurement.");
      return;
    }

    const ids = assets.map((asset) => asset.id);
    const existingBaseline = measurementBaseline.current;
    const canResume = existingBaseline !== null && hasSameMeasurementParticipants(existingBaseline, ids);
    if (canResume) {
      setHasMeasurementBaseline(true);
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
    setHasMeasurementBaseline(true);
    setIsMeasuring(true);
    setMessage("Drift measurement started with a frozen local-time baseline.");
  }, [assets, isMeasuring]);

  useEffect(() => {
    const baseline = measurementBaseline.current;
    if (baseline && !hasSameMeasurementParticipants(baseline, assets.map((asset) => asset.id))) {
      clearMeasurement("Measurement baseline reset because the participant set changed.");
    }
  }, [assets, clearMeasurement]);

  useEffect(() => {
    if (!isMeasuring) return;
    const handle = window.setInterval(() => {
      const baseline = measurementBaseline.current;
      const master = assets[0];
      const masterController = master ? mediaControllers.current[master.id] : null;
      if (!baseline || !master || !masterController) return;
      if (!hasSameMeasurementParticipants(baseline, assets.map((asset) => asset.id))) {
        clearMeasurement("Measurement stopped because the participant set changed.");
        return;
      }
      if (masterController.isPaused()) return;

      const global = masterController.getCurrentTime();
      const readings = assets.map((asset) => ({
        id: asset.id,
        actualLocalTime: mediaControllers.current[asset.id]?.getCurrentTime() ?? Number.NaN,
      }));
      const baselineVideos = applyMeasurementBaseline(baseline, readings);
      if (!baselineVideos) {
        clearMeasurement("Measurement stopped because a participant had no frozen offset.");
        return;
      }

      const samples = createSlaveDriftSamples(
        performance.now(),
        global,
        master.id,
        baselineVideos,
      ).filter((sample) => Number.isFinite(sample.actualLocalTime) && Number.isFinite(sample.errorSeconds));
      recorder.current.record(samples);
      setDriftSummary(recorder.current.summary());
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(handle);
  }, [assets, clearMeasurement, isMeasuring]);

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
        onVideoPause={refreshPlaybackState}
        onVideoPlay={refreshPlaybackState}
      />

      <MeasurementPanel
        hasBaseline={hasMeasurementBaseline}
        isMeasuring={isMeasuring}
        onReset={() => clearMeasurement("Drift measurement reset.")}
        onToggle={toggleMeasurement}
        sampleIntervalMs={SAMPLE_INTERVAL_MS}
        summary={driftSummary}
        videoCount={assets.length}
      />
    </main>
  );
}

export default App;
