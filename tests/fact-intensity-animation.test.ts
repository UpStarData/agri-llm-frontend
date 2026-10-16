import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FactPoint } from "../src/api/fact";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[], cursor: 0,
  state: undefined as unknown,
  effect: undefined as undefined | (() => void | (() => void)),
}));
vi.mock("react", () => ({
  useRef: (value: unknown) => {
    const index = hooks.cursor++;
    return hooks.refs[index] ??= { current: value };
  },
  useState: (initial: unknown) => {
    hooks.state ??= initial;
    return [hooks.state, (value: unknown) => { hooks.state = value; }];
  },
  useEffect: (effect: typeof hooks.effect) => { hooks.effect = effect; },
}));
import { useFactIntensityAnimation } from "../src/hooks/useFactIntensityAnimation";

const points: FactPoint[] = [{ factId: "a", geoPoint: [112, 28], intensityArr: [98, 54, 24, 6, 0] }];
const useRender = (data = points, time = "7d", ready = true, active = true) => {
  // oxlint-disable-next-line react/immutability -- 重置模拟 Hook 的调用游标。
  hooks.cursor = 0;
  return useFactIntensityAnimation(data, time, ready, active);
};
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const step = (now: number) => {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(now));
};
beforeEach(() => {
  hooks.refs = []; hooks.state = undefined; hooks.effect = undefined;
  frames = new Map(); nextFrame = 0;
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("仅时间筛选触发事实热度播放", () => {
  it("首次加载和其他筛选响应不播放、不清空", () => {
    expect(useRender()).toEqual({ hidePoints: false, seconds: undefined });
    hooks.effect!();
    const otherResult = [{ ...points[0], factId: "b" }];
    expect(useRender(otherResult)).toEqual({ hidePoints: false, seconds: undefined });
    hooks.effect!();
    expect(frames.size).toBe(0);
  });

  it("时间切换立即清空，等待响应再播放，3.2 秒后停止并保持末值", () => {
    useRender(); hooks.effect!();
    expect(useRender(points, "30d", false).hidePoints).toBe(true);
    hooks.effect!();
    expect(useRender(points, "30d", false).hidePoints).toBe(true);
    expect(frames.size).toBe(0);
    const response = [...points];
    expect(useRender(response, "30d").hidePoints).toBe(true);
    hooks.effect!();
    expect(useRender(response, "30d")).toEqual({ hidePoints: false, seconds: 0 });
    step(1200);
    expect(useRender(response, "30d").seconds).toBe(1.2);
    step(3200);
    expect(useRender(response, "30d").seconds).toBe(3.2);
    expect(frames.size).toBe(0);
  });

  it("再次切换时间或其他筛选到来时取消旧帧；其他筛选恢复普通展示", () => {
    useRender(); hooks.effect!();
    useRender(points, "30d");
    const cleanup = hooks.effect!();
    expect(frames.size).toBe(1);
    if (typeof cleanup === "function") cleanup();
    useRender(points, "30d", false); hooks.effect!();
    expect(frames.size).toBe(0);
    expect(useRender(points, "30d")).toEqual({ hidePoints: false, seconds: undefined });
  });
});
