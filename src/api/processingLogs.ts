import type { Mode } from "@/types";
import type { RelationProcessingEvent } from "./relation";

export type ProcessingLogConnection =
  "connecting" | "connected" | "reconnecting" | "closed";

const paths: Record<Mode, string> = {
  fact: "/processing-logs/live",
  relation: "/relations/processing-logs/live",
};

/** 两层共用连接生命周期；EventSource 自带断线重连，无需另设定时器。 */
export function subscribeProcessingLogs(
  mode: Mode,
  onLog: (log: string, event?: RelationProcessingEvent) => void,
  onConnectionChange: (state: ProcessingLogConnection) => void,
) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
    /\/$/,
    "",
  );
  onConnectionChange("connecting");
  const stream = new EventSource(`${baseUrl}${paths[mode]}`);
  let closed = false;
  stream.onmessage = (event: MessageEvent<string>) => {
    if (closed || !event.data.trim()) return;
    // 两层都接受普通文本；关联层的结构化事件额外用于地图高亮。
    let payload: RelationProcessingEvent | undefined;
    try {
      const value = JSON.parse(event.data);
      if (
        value &&
        typeof value === "object" &&
        typeof value.id === "string" &&
        typeof value.occurredAt === "string" &&
        typeof value.message === "string" &&
        [value.entityIds, value.relationIds].every(
          (ids) =>
            ids === undefined ||
            (Array.isArray(ids) && ids.every((id) => typeof id === "string")),
        )
      ) {
        payload = value;
      }
    } catch {
      // 普通文本直接展示，不能因为它不是 JSON 就丢弃推送。
    }
    onLog(
      payload ? `${payload.occurredAt}  ${payload.message}` : event.data,
      payload,
    );
  };
  stream.onopen = () => {
    if (!closed) onConnectionChange("connected");
  };
  stream.onerror = () => {
    if (!closed)
      onConnectionChange(
        stream.readyState === EventSource.CLOSED ? "closed" : "reconnecting",
      );
  };
  return () => {
    closed = true;
    stream.onmessage = null;
    stream.onopen = null;
    stream.onerror = null;
    stream.close();
  };
}
