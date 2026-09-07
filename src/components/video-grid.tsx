import type { PlatformMp4TimingInfo, PlatformPreparedVideoFile } from "../platform/tauri-media";

export interface VideoAsset extends PlatformPreparedVideoFile {
  id: string;
  duration: number;
  width: number;
  height: number;
  timing: PlatformMp4TimingInfo | null;
  timingError: string | null;
  playbackError: string | null;
}

export interface LoadError {
  path: string;
  error: string;
}

interface VideoGridProps {
  assets: VideoAsset[];
  loadErrors: LoadError[];
  onAddVideos: () => void;
  onCapture: (asset: VideoAsset) => void;
  onMetadata: (id: string, metadata: Pick<VideoAsset, "duration" | "width" | "height">) => void;
  onTimeUpdate: (id: string, currentTime: number) => void;
  onVideoElement: (id: string, element: HTMLVideoElement | null) => void;
  onVideoError: (id: string) => void;
  onVideoPause: () => void;
  onVideoPlay: () => void;
}

function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function formatSeconds(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(3)} s` : "—";
}

export function VideoGrid({
  assets,
  loadErrors,
  onAddVideos,
  onCapture,
  onMetadata,
  onTimeUpdate,
  onVideoElement,
  onVideoError,
  onVideoPause,
  onVideoPlay,
}: VideoGridProps) {
  return (
    <>
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
            <button className="primary" type="button" onClick={onAddVideos}>Choose local files</button>
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
                ref={(element) => onVideoElement(asset.id, element)}
                crossOrigin="anonymous"
                src={asset.sourceUrl}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  onMetadata(asset.id, { duration: video.duration, width: video.videoWidth, height: video.videoHeight });
                }}
                onTimeUpdate={(event) => onTimeUpdate(asset.id, event.currentTarget.currentTime)}
                onPlay={onVideoPlay}
                onPause={onVideoPause}
                onError={() => onVideoError(asset.id)}
              />
              <div className="metadata">
                <span>{asset.width > 0 ? `${asset.width}×${asset.height}` : "Reading dimensions…"}</span>
                <span>{formatSeconds(asset.duration)}</span>
                <span>{asset.timing?.cfr ? `${asset.timing.frameDurationSeconds?.toFixed(4)} s/frame CFR` : asset.timingError ? "Timing unknown" : "Reading timing…"}</span>
              </div>
              {asset.playbackError && <p className="error">{asset.playbackError}</p>}
              {asset.timingError && <p className="warning">Playable status is independent; exact timing is unavailable for this file.</p>}
              <button type="button" onClick={() => onCapture(asset)} disabled={asset.width === 0}>Capture native PNG</button>
            </article>
          ))
        )}
      </section>
    </>
  );
}
