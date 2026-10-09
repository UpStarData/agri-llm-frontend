import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  speed: number;
  phase: number;
};

function createStars(count: number): Star[] {
  let seed = 20260928;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    radius: 0.7 + random() * 1.1,
    opacity: 0.42 + random() * 0.48,
    speed: 1.5 + random() * 4,
    phase: random() * Math.PI * 2,
  }));
}

export default function StarField({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewWidth = Math.max(1, width);
    const viewHeight = Math.max(1, height);
    canvas.width = Math.round(viewWidth * ratio);
    canvas.height = Math.round(viewHeight * ratio);
    context.scale(ratio, ratio);

    const stars = createStars(
      Math.max(70, Math.min(260, Math.round((viewWidth * viewHeight) / 8500))),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;
    const draw = (time: number) => {
      context.clearRect(0, 0, viewWidth, viewHeight);
      const seconds = reduceMotion ? 0 : time / 1000;
      for (const star of stars) {
        const x =
          (((star.x * viewWidth + seconds * star.speed) % viewWidth) +
            viewWidth) %
          viewWidth;
        const y = star.y * viewHeight;
        const shimmer = reduceMotion
          ? 1
          : 0.82 + 0.18 * Math.sin(seconds * 0.55 + star.phase);
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(190, 220, 233, ${star.opacity * shimmer})`;
        context.fill();
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [width, height]);

  return (
    <canvas ref={canvasRef} className="map-starfield" aria-hidden="true" />
  );
}
