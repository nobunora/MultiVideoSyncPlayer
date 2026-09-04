export interface CapturedFrame {
  width: number;
  height: number;
  pngBytes: number[];
}

function dataUrlToBytes(dataUrl: string): number[] {
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new Error("Canvas returned an invalid PNG data URL.");

  const binary = atob(encoded);
  return Array.from(binary, (character) => character.charCodeAt(0));
}

export function captureCurrentFrame(video: HTMLVideoElement): CapturedFrame {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error("The video has no decoded frame dimensions yet.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    pngBytes: dataUrlToBytes(canvas.toDataURL("image/png")),
  };
}
