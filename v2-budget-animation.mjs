// Adapted from the circular network animation in ibm-dataton/frontend/app/ml-process/page.tsx.
const duration = 7700;
const nodeCount = 96;
const edgeCount = 312;
const edges = Array.from({ length: edgeCount }, (_, index) => {
  const from = (index * 37 + 11) % nodeCount;
  return { from, to: (from + 13 + ((index * 29 + 17) % 69)) % nodeCount,
    bend: ((index * 19) % 7) - 3 };
});
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => 1 - (1 - clamp(value)) ** 3;
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function curvePoint(start, control, end, amount) {
  const t = clamp(amount), inverse = 1 - t;
  return { x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y };
}

function draw(canvas, time) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const center = { x: width / 2, y: height * (width < 600 ? .4 : .46) };
  const radius = Math.min(width * .42, height * .31) * ease(time / 1300);
  const connect = clamp((time - 800) / 2100);
  const release = smooth((time - 4700) / 1100);
  const gather = smooth((time - 5200) / 1000);
  const drop = smooth((time - 6100) / 650);
  const grow = smooth((time - 6300) / 800);
  const morph = smooth((time - 7100) / 600);
  const nodePoint = index => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2 / nodeCount) * (1 - gather);
    return { x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius + (index === 0 ? radius * drop : 0) };
  };
  const activeEdges = [];
  context.lineWidth = Math.max(.7, width / 1100);
  for (let index = 0; index < edgeCount && release < 1; index++) {
    const reveal = clamp(connect * edgeCount - index);
    if (!reveal) continue;
    const edge = edges[index];
    const start = nodePoint(edge.from), end = nodePoint(edge.to);
    const control = { x: center.x + ((start.x + end.x) / 2 - center.x) * .2 + edge.bend * 2.5,
      y: center.y + ((start.y + end.y) / 2 - center.y) * .2 - edge.bend * 2.5 };
    const visible = reveal * (1 - release);
    context.beginPath();
    const first = curvePoint(start, control, end, (1 - visible) / 2);
    context.moveTo(first.x, first.y);
    for (let step = 1; step <= 10; step++) {
      const point = curvePoint(start, control, end, (1 - visible) / 2 + visible * step / 10);
      context.lineTo(point.x, point.y);
    }
    context.strokeStyle = `rgba(48, 91, 77, ${.12 * (1 - release)})`;
    context.stroke();
    activeEdges.push({ start, control, end, visible });
  }

  const flow = clamp((time - 1700) / 2100);
  const particleCount = Math.floor(160 * flow * (1 - release));
  for (let index = 0; index < particleCount; index++) {
    const edge = activeEdges[(index * 47) % activeEdges.length];
    if (!edge || edge.visible < .4) continue;
    const position = (((index * 43) % 101) / 101 + time * .00035) % 1;
    const point = curvePoint(edge.start, edge.control, edge.end, position);
    context.beginPath();
    context.arc(point.x, point.y, 1.1 + flow * .8, 0, Math.PI * 2);
    context.fillStyle = `rgba(181, 47, 39, ${.35 + flow * .4})`;
    context.fill();
  }

  for (let index = nodeCount - 1; index >= 0; index--) {
    const point = nodePoint(index);
    const angle = -Math.PI / 2 + (index * Math.PI * 2 / nodeCount) * (1 - gather);
    const fade = index === 0 ? 1 : 1 - ease((gather - .55) / .45);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle + Math.PI / 2);
    context.fillStyle = index === 0 && gather > 0 ? '#b52f27' : `rgba(23, 48, 41, ${.58 * fade})`;
    if (index === 0 && morph > 0) {
      const size = Math.min(width, height);
      const outerWidth = size * (.15 - .055 * morph);
      const outerHeight = size * (.085 + .05 * morph);
      context.beginPath();
      context.roundRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, outerWidth * .48 * morph);
      context.fill();
      context.fillStyle = '#f8f8f3';
      const innerWidth = outerWidth * .42 * morph;
      const innerHeight = outerHeight * .56 * morph;
      context.beginPath();
      context.roundRect(-innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight, innerWidth / 2);
      context.fill();
    } else {
      const blockWidth = index === 0 ? 2.6 + (Math.min(width, height) * .15 - 2.6) * grow : 2.6;
      const blockHeight = index === 0 ? 8 + (Math.min(width, height) * .085 - 8) * grow : 8;
      context.fillRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
    }
    context.restore();
  }
}

export function startBudgetAnimation(canvas, onProgress, onComplete) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onProgress(100);
    onComplete();
    return () => {};
  }
  let frame, elapsed = 0, previous;
  const observer = new ResizeObserver(() => draw(canvas, elapsed));
  observer.observe(canvas);
  const tick = now => {
    if (previous !== undefined && !document.hidden)
      elapsed = Math.min(duration, elapsed + Math.min(now - previous, 100));
    previous = now;
    draw(canvas, elapsed);
    onProgress(Math.round(100 * elapsed / duration));
    if (elapsed < duration) frame = requestAnimationFrame(tick);
    else { observer.disconnect(); onComplete(); }
  };
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); observer.disconnect(); };
}
