import { connect } from './platform';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const ctx = canvas.getContext('2d')!;

const sdk = await connect();
const user = await sdk.getUser();
status.textContent = user
  ? `Hi ${user.nickname}! Click to score.`
  : 'Playing as guest. Click to score.';

let score = 0;
let paused = false;
sdk.on('pause', () => (paused = true));
sdk.on('resume', () => (paused = false));

canvas.addEventListener('click', async () => {
  score += 10;
  if (sdk.has('score')) {
    await sdk.submitScore(score);
  }
});

function frame(t: number) {
  if (!paused) {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e39a4f';
    ctx.beginPath();
    ctx.arc(320 + Math.cos(t / 500) * 200, 180, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eee';
    ctx.font = '24px system-ui';
    ctx.fillText(`Score ${score}`, 16, 36);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

await sdk.ready();
