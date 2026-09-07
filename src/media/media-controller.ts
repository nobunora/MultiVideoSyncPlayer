export interface MediaController {
  getCurrentTime(): number;
  getDuration(): number;
  seek(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  isPaused(): boolean;
  isSeeking?(): boolean;
}

export class HtmlVideoController implements MediaController {
  constructor(private readonly video: HTMLVideoElement) {}

  getCurrentTime(): number {
    return this.video.currentTime;
  }

  getDuration(): number {
    return this.video.duration;
  }

  seek(time: number): Promise<void> {
    if (!Number.isFinite(time)) {
      return Promise.reject(new Error("Seek target must be finite."));
    }

    const duration = this.video.duration;
    if (time < 0 || (Number.isFinite(duration) && time > duration)) {
      return Promise.reject(new Error("Seek target is outside the playable media range."));
    }

    const target = time;
    if (Math.abs(this.video.currentTime - target) < 0.0005 && !this.video.seeking) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.video.removeEventListener("seeked", onSeeked);
        this.video.removeEventListener("error", onError);
      };
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("The video seek failed."));
      };

      this.video.addEventListener("seeked", onSeeked, { once: true });
      this.video.addEventListener("error", onError, { once: true });
      this.video.currentTime = target;
    });
  }

  play(): Promise<void> {
    return this.video.play();
  }

  pause(): void {
    this.video.pause();
  }

  isPaused(): boolean {
    return this.video.paused;
  }

  isSeeking(): boolean {
    return this.video.seeking;
  }
}
