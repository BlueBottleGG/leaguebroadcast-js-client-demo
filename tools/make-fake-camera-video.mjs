// Generates a Y4M test-pattern video used as Chromium's fake webcam
// (--use-file-for-fake-video-capture). Pure Node, no ffmpeg needed.
// Pattern: colored background with a bouncing white bar and a frame counter
// strip, so frozen video is immediately visible.
import fs from "node:fs";

const W = 320;
const H = 180;
const FPS = 30;
const SECONDS = 4; // loops seamlessly
const FRAMES = FPS * SECONDS;

const out = process.argv[2] ?? "fake-camera.y4m";

const ySize = W * H;
const cSize = (W / 2) * (H / 2);
const frame = Buffer.alloc(ySize + cSize * 2);

const fd = fs.openSync(out, "w");
fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420\n`);

for (let f = 0; f < FRAMES; f++) {
  // Background: mid-gray luma with a subtle project-accent chroma.
  frame.fill(90, 0, ySize);
  frame.fill(140, ySize, ySize + cSize); // U
  frame.fill(190, ySize + cSize); // V

  // Bouncing white bar (24px wide).
  const span = W - 24;
  const phase = (f / FRAMES) * 2;
  const pos = Math.round((phase <= 1 ? phase : 2 - phase) * span);
  for (let y = 0; y < H; y++) {
    frame.fill(235, y * W + pos, y * W + pos + 24);
  }

  // Frame-counter strip: a black notch that steps across the top each frame.
  const notch = Math.floor((f / FRAMES) * W);
  for (let y = 0; y < 12; y++) {
    frame.fill(16, y * W, y * W + notch);
  }

  fs.writeSync(fd, "FRAME\n");
  fs.writeSync(fd, frame);
}
fs.closeSync(fd);
console.log(`Wrote ${out} (${W}x${H}, ${FPS}fps, ${FRAMES} frames)`);
