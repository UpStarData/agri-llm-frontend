import type { FactPoint } from "@/api/fact";

/** 对齐原型：整轮 3.2 秒，使用先快后慢的 2.2 次缓出。 */
export const FACT_INTENSITY_DURATION_SECONDS = 3.2;

export const factIntensityAt = (point: FactPoint, seconds: number): number | undefined => {
  const values = point.intensityArr;
  if (!values?.length) return point.intensity;
  const elapsed = Math.min(1, Math.max(0, seconds) / FACT_INTENSITY_DURATION_SECONDS);
  const progress = (1 - Math.pow(1 - elapsed, 2.2)) * (values.length - 1);
  const index = Math.min(Math.floor(progress), values.length - 1);
  // 保留倒序播放方向，直接按索引读取，避免每帧 reverse() 改写接口缓存。
  const from = values[values.length - 1 - index];
  const to = values[Math.max(0, values.length - 2 - index)];
  return from + (to - from) * Math.min(1, progress - index);
};
