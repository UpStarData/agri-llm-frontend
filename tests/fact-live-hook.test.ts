import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => (() => void) | undefined),
  receive: undefined as undefined | ((point: { factId: string }) => void),
  close: vi.fn(), invalidate: vi.fn(), getData: vi.fn(),
  state: {} as { scope: string; hasNew: boolean; ids: string[] },
}));
vi.mock("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) => { mocks.effect = effect; },
  useState: (initial: typeof mocks.state) => {
    mocks.state = initial;
    return [initial, (next: typeof initial | ((prev: typeof initial) => typeof initial)) => {
      mocks.state = typeof next === "function" ? next(mocks.state) : next;
    }];
  },
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({
  invalidateQueries: mocks.invalidate, getQueryData: mocks.getData,
}) }));
vi.mock("../src/api/factLive", () => ({ subscribeFactPoints: (_: string, receive: typeof mocks.receive) => {
  mocks.receive = receive;
  return mocks.close;
} }));
import { useFactLive } from "../src/hooks/useFactLive";

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.getData.mockReturnValue([{ factId: "a" }]);
});
afterEach(() => vi.useRealTimers());
describe("事实推送与快照筛选协作", () => {
  it("合并突发事件，只刷新地图，过滤后高亮，6 秒后恢复", async () => {
    useFactLive({ view: "china", Q: "水稻" }, true);
    const cleanup = mocks.effect!();
    mocks.receive!({ factId: "a" });
    mocks.receive!({ factId: "filtered-out" });
    expect(mocks.state.hasNew).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: ["fact", "points", { view: "china", Q: "水稻" }], exact: true,
    }, { throwOnError: true });
    expect(mocks.state.ids).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(6000);
    expect(mocks.state.ids).toEqual([]);
    expect(mocks.state.hasNew).toBe(true);
    cleanup?.();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("禁用时不订阅，清理后不再刷新", async () => {
    useFactLive({}, false);
    expect(mocks.effect!()).toBeUndefined();
    useFactLive({}, true);
    const cleanup = mocks.effect!();
    mocks.receive!({ factId: "a" });
    cleanup?.();
    await vi.runAllTimersAsync();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("请求失败后重试，并保留待高亮事实", async () => {
    mocks.invalidate.mockRejectedValueOnce(new Error("offline"));
    useFactLive({}, true);
    const cleanup = mocks.effect!();
    mocks.receive!({ factId: "a" });
    await vi.advanceTimersByTimeAsync(1250);
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
    expect(mocks.state.ids).toEqual(["a"]);
    cleanup?.();
  });
});
