import { afterEach, expect, it, vi } from 'vitest';
import { subscribeProcessingLogs } from '../src/api/processingLogs';

afterEach(() => vi.unstubAllGlobals());
it('日志原样传递 JSON、纯文本与重复消息，不解析或丢弃', () => {

  class FakeStream {
    static CLOSED = 2;
    readyState = 1;
    onmessage?: (event: { data: string }) => void;
    onopen?: () => void;
    onerror?: () => void;
    close = vi.fn();
    constructor() { streams.push(this); }
  }
  const streams: FakeStream[] = [];
  vi.stubGlobal('EventSource', FakeStream);
  const received: string[] = [];
  const cleanup = subscribeProcessingLogs((text) => received.push(text), () => {});
  const stream = streams[0];
  const messages = ['{ "content": "原文" }', '未结构化日志\n第二行', '{broken', '{broken'];
  messages.forEach((data) => stream.onmessage?.({ data }));
  expect(received).toEqual(messages);
  cleanup();
  expect(stream!.close).toHaveBeenCalledOnce();
});
