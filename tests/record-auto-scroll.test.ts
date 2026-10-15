import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecordAutoScroll as runAutoScroll } from "../src/hooks/useRecordAutoScroll";
import type { RecordAutoScrollOptions } from "../src/hooks/useRecordAutoScroll";

const effects = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useLayoutEffect: (effect: () => void) => effect(),
  useEffect: (effect: () => (() => void)) => effects.cleanups.push(effect()),
}));

class Content extends EventTarget {
  scrollTop = 0;
  scrollHeight = 300;
  clientHeight = 100;
  contains() { return false; }
}

describe("卡片自动轮播", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { hidden: false, activeElement: null });
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => {
    effects.cleanups.splice(0).forEach((cleanup) => cleanup());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const setup = (overrides: Partial<RecordAutoScrollOptions> = {}, enabled = true) => {
    const element = new Content();
    const options = { scope: "fact", busy: false, hasNextPage: false, hasRecords: true,
      loadMore: vi.fn(async () => {}), refresh: vi.fn(async () => {}), ...overrides };
    runAutoScroll({ current: element as unknown as HTMLDivElement }, enabled, options);
    return { element, options };
  };
  it("自动滚到底部，停留后只刷新一次并回到顶部", async () => {
    const { element, options } = setup();
    await vi.advanceTimersByTimeAsync(9000);
    expect(element.scrollTop).toBe(180);
    expect(options.refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3200);
    expect(options.refresh).toHaveBeenCalledTimes(1);
    expect(element.scrollTop).toBeLessThan(5);
  });
  it("分页请求完成前不重复加载或刷新，也能加载无滚动条的下一页", async () => {
    let resolve!: () => void;
    const loadMore = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const { element, options } = setup({ hasNextPage: true, loadMore });
    element.scrollHeight = 100;
    await vi.advanceTimersByTimeAsync(5000);
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(options.refresh).not.toHaveBeenCalled();
    options.hasNextPage = false;
    resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
  it("悬停、后台、关闭和正在请求时暂停，离开后恢复", async () => {
    const { element } = setup();
    element.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(element.scrollTop).toBe(0);
    element.dispatchEvent(new Event("mouseleave"));
    await vi.advanceTimersByTimeAsync(2100);
    expect(element.scrollTop).toBeGreaterThan(0);
    document.hidden = true;
    const top = element.scrollTop;
    await vi.advanceTimersByTimeAsync(2000);
    expect(element.scrollTop).toBe(top);
    document.hidden = false;
    const closed = setup({}, false);
    const busy = setup({ busy: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(closed.element.scrollTop).toBe(0);
    expect(busy.element.scrollTop).toBe(0);
  });
  it("短列表按 30 秒刷新，卸载后停止", async () => {
    const { element, options } = setup();
    element.scrollHeight = 100;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(options.refresh).toHaveBeenCalledTimes(1);
    effects.cleanups.splice(0).forEach((cleanup) => cleanup());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(options.refresh).toHaveBeenCalledTimes(1);
  });
  it("占位数据期间保留滚动位置，新卡片落地时才回到顶部", () => {
    const { element } = setup();
    element.scrollTop = 120;
    const next = (overrides: Partial<RecordAutoScrollOptions>) => ({
      scope: "fact-next", busy: false, hasNextPage: false, hasRecords: true,
      loadMore: vi.fn(async () => {}), refresh: vi.fn(async () => {}), ...overrides });
    const ref = { current: element as unknown as HTMLDivElement };
    // 切换筛选：结果未到，旧卡片继续留在原位。
    runAutoScroll(ref, true, next({ busy: true, pending: true }));
    expect(element.scrollTop).toBe(120);
    // 新卡片替换旧卡片：与内容同帧回到顶部，视觉上只有一次变化。
    runAutoScroll(ref, true, next({ pending: false }));
    expect(element.scrollTop).toBe(0);
  });
});
