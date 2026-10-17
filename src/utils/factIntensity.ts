import type { FactPoint } from "@/api/fact";

/** 对齐原型：整轮 3.2 秒，使用先快后慢的 2.2 次缓出。 */
export const FACT_INTENSITY_DURATION_SECONDS = 3.2;
const FACT_REVEAL_FADE_SECONDS = 0.18;

/** 只安排展示时机：新事实先出现，无时间或同一时间的点保留接口顺序。 */
export const factRevealDelays = (points: FactPoint[]) => {
  const ordered = points.map((point, index) => ({
    point, index, time: Date.parse(point.occurredAt ?? "") || 0,
  })).sort((a, b) => b.time - a.time || a.index - b.index);
  return new Map(ordered.map(({ point }, index) => [
    point.factId,
    // 反求缓出曲线上的出现时刻，最后预留淡入时间，整轮仍在 3.2 秒内结束。
    (FACT_INTENSITY_DURATION_SECONDS - FACT_REVEAL_FADE_SECONDS) *
      (1 - Math.pow(1 - index / ordered.length, 1 / 2.2)),
  ]));
};

export const factRevealAlpha = (seconds: number, delay: number) => {
  const progress = Math.min(1, Math.max(0, (seconds - delay) / FACT_REVEAL_FADE_SECONDS));
  return 1 - (1 - progress) ** 2;
};

export const factIntensityAt = (point: FactPoint, seconds: number): number | undefined => {
  const values = point.intensityArr;
  if (!values?.length) return point.intensity;
  const elapsed = Math.min(1, Math.max(0, seconds) / FACT_INTENSITY_DURATION_SECONDS);
  const progress = (1 - Math.pow(1 - elapsed, 2.2)) * (values.length - 1);
  const index = Math.min(Math.floor(progress), values.length - 1);
  // 保留倒序播放方向，直接按索引读取，避免每帧 reverse() 改写接口缓存。
  // 最后一段平滑落到静态热度，结束后与普通刷新保持相同热度。
  const valueAt = (index: number) => index === 0 ? point.intensity ?? values[0] : values[index];
  const from = valueAt(values.length - 1 - index);
  const to = valueAt(Math.max(0, values.length - 2 - index));
  return from + (to - from) * Math.min(1, progress - index);
};
