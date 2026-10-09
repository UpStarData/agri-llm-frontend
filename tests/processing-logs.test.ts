import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeProcessingLogs } from "../src/api/processingLogs";

class FakeStream {
  static CLOSED = 2;
  readyState = 1;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    streams.push(this);
  }
}
let streams: FakeStream[] = [];
beforeEach(() => {
  streams = [];
  vi.stubGlobal("EventSource", FakeStream);
});
afterEach(() => vi.unstubAllGlobals());

describe("共用 SSE 连接", () => {
  it.each(["fact", "relation"] as const)(
    "%s 保留文本、非事件 JSON 与重复消息",
    (mode) => {
      const received: string[] = [];
      const cleanup = subscribeProcessingLogs(
        mode,
        (text) => received.push(text),
        () => {},
      );
      const messages = [
        '{ "content": "原文" }',
        "未结构化日志\n第二行",
        "{broken",
        "{broken",
      ];
      messages.forEach((data) => streams[0].onmessage?.({ data }));
      expect(received).toEqual(messages);
      expect(streams[0].url).toMatch(
        mode === "fact"
          ? /\/v1\/processing-logs\/live$/
          : /\/relations\/processing-logs\/live$/,
      );
      cleanup();
      expect(streams[0].close).toHaveBeenCalledOnce();
    },
  );
  it("更新连接状态，关闭后不再交付迟到消息", () => {
    const receive = vi.fn(),
      connection = vi.fn();
    const cleanup = subscribeProcessingLogs("relation", receive, connection);
    const stream = streams[0],
      lateMessage = stream.onmessage;
    stream.onopen?.();
    stream.onerror?.();
    stream.readyState = 2;
    stream.onerror?.();
    expect(connection.mock.calls.flat()).toEqual([
      "connecting",
      "connected",
      "reconnecting",
      "closed",
    ]);
    cleanup();
    lateMessage?.({ data: "已关闭连接的消息" });
    expect(receive).not.toHaveBeenCalled();
    expect(stream.onmessage).toBeNull();
  });
  it("有效结构化事件可高亮，非法 ID 数据仅按原文展示", () => {
    const receive = vi.fn();
    subscribeProcessingLogs("relation", receive, () => {});
    const event = {
      id: "log1",
      occurredAt: "2026-10-09",
      message: "关系更新",
      entityIds: ["e1"],
      relationIds: ["r1"],
    };
    streams[0].onmessage?.({ data: JSON.stringify(event) });
    expect(receive).toHaveBeenLastCalledWith("2026-10-09  关系更新", event);
    const invalid = JSON.stringify({ ...event, entityIds: "e1" });
    streams[0].onmessage?.({ data: invalid });
    expect(receive).toHaveBeenLastCalledWith(invalid, undefined);
  });
});
