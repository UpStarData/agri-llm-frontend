import { useEffect, useRef, useState } from "react";
import type { FactPoint } from "@/api/fact";
import { FACT_INTENSITY_DURATION_SECONDS } from "@/utils/factIntensity";

/** 只为时间条件变化后的响应播放；其他查询结果更新会取消播放。 */
export const useFactIntensityAnimation = (
  points: FactPoint[] | undefined,
  timeKey: string,
  ready: boolean,
  active: boolean,
) => {
  const previousTime = useRef(timeKey);
  const pending = useRef(false);
  const [playback, setPlayback] = useState<{
    points: FactPoint[] | undefined;
    timeKey: string;
    seconds?: number;
  }>({ points, timeKey });

  // 动画控制器需在响应到达时同步首帧，并在条件变化时清理旧动画。
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (previousTime.current !== timeKey) {
      previousTime.current = timeKey;
      pending.current = active;
      setPlayback({ points, timeKey: "" });
    }
    if (!active) {
      pending.current = false;
      setPlayback({ points, timeKey });
      return;
    }
    if (!ready) {
      setPlayback({ points, timeKey: pending.current ? "" : timeKey });
      return;
    }
    if (!pending.current) return;
    pending.current = false;
    const duration = points?.some((point) => (point.intensityArr?.length ?? 0) > 1)
      ? FACT_INTENSITY_DURATION_SECONDS
      : 0;
    setPlayback({ points, timeKey, seconds: 0 });
    if (!duration) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min(duration, (now - start) / 1000);
      setPlayback({ points, timeKey, seconds });
      if (seconds < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [points, timeKey, ready, active]);
  /* oxlint-enable react/set-state-in-effect */

  return {
    // 时间变化的首帧就清空，随后等待该时间条件的响应，不能展示上一批占位点。
    hidePoints: active && playback?.timeKey !== timeKey,
    seconds: active && playback?.points === points && playback?.timeKey === timeKey
      ? playback.seconds
      : undefined,
  };
};
