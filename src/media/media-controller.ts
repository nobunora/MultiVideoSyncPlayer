export interface MediaController {
  getCurrentTime(): number;
  getDuration(): number;
  seek(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  isPaused(): boolean;
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
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        this.video.removeEventListener("seeked", onSeeked);
        this.video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        this.video.removeEventListener("seeked", onSeeked);
        this.video.removeEventListener("error", onError);
        reject(new Error("The video seek failed."));
      };

      this.video.addEventListener("seeked", onSeeked, { once: true });
      this.video.addEventListener("error", onError, { once: true });
      this.video.currentTime = Math.max(0, time);
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
}
