import type { FactPoint, FactView } from "./fact";

/** 独立于处理日志的事实通道；重连由 EventSource 负责，不回放历史高亮。 */
export function subscribeFactPoints(view: FactView, onPoint: (point: FactPoint) => void) {
  const base = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const stream = new EventSource(`${base}/facts/points/live?view=${encodeURIComponent(view)}`);
  let closed = false;
  const seen = new Set<string>();
  stream.onmessage = (event: MessageEvent<string>) => {
    if (closed) return;
    try {
      const point = JSON.parse(event.data);
      if (!point || typeof point.factId !== "string" || !point.factId ||
        !Array.isArray(point.geoPoint) || point.geoPoint.length !== 2 ||
        !point.geoPoint.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) ||
        Math.abs(point.geoPoint[0]) > 180 || Math.abs(point.geoPoint[1]) > 90 ||
        seen.has(point.factId)) return;
      seen.add(point.factId);
      if (seen.size > 5000) seen.delete(seen.values().next().value!);
      onPoint(point);
    } catch {
      // 心跳注释不会进入 onmessage；异常 JSON 不能中断后续推送。
    }
  };
  return () => {
    closed = true;
    stream.onmessage = null;
    stream.close();
  };
}
