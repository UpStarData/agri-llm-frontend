import { afterEach, describe, expect, it, vi } from "vitest";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { createIdlePolling, ENTITY_POLL_INTERVAL, SCROLL_IDLE_DELAY } from "../src/utils/idlePolling";

afterEach(() => vi.useRealTimers());

describe("本体列表空闲轮询", () => {
  it("每 30 秒刷新，持续滚动时延后，停止 800ms 后执行一次", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const poller = createIdlePolling({ isBusy: () => false, refresh });
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL - 100);
    poller.markActivity();
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).not.toHaveBeenCalled();
    poller.markActivity();
    await vi.advanceTimersByTimeAsync(SCROLL_IDLE_DELAY - 1);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(201);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL);
    expect(refresh).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("等待分页请求结束，不并行刷新，不累积多个到期任务", async () => {
    vi.useFakeTimers();
    let busy = true;
    let resolveRefresh!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    const poller = createIdlePolling({ isBusy: () => busy, refresh });
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL * 2);
    expect(refresh).not.toHaveBeenCalled();
    busy = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(poller.isRefreshing()).toBe(true);
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL * 2);
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.isRefreshing()).toBe(false);
    poller.stop();
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL * 2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("失败后继续轮询，筛选切换或卸载后的旧任务不再调度", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockRejectedValue(new Error("网络失败"));
    const poller = createIdlePolling({ isBusy: () => false, refresh });
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL * 2);
    expect(refresh).toHaveBeenCalledTimes(2);
    poller.stop();
    await vi.advanceTimersByTimeAsync(ENTITY_POLL_INTERVAL);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe("无限列表刷新与分页兼容", () => {
  it("后台刷新保留旧数据，顺序更新已加载页，新增数据后继续下一页无重复", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let rows = ["a", "b", "c", "d", "e", "f"];
    const requests: number[] = [];
    let pause: Promise<void> | undefined;
    let resume!: () => void;
    const observer = new InfiniteQueryObserver(client, {
      queryKey: ["relation", "list"], enabled: false, initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        requests.push(pageParam);
        await pause;
        return { page: pageParam, items: rows.slice((pageParam - 1) * 2, pageParam * 2), total: rows.length };
      },
      getNextPageParam: (page, pages) => pages.flatMap((page) => page.items).length < page.total ? page.page + 1 : undefined,
    });
    try {
      await observer.refetch();
      await observer.fetchNextPage();
      const before = client.getQueryData(["relation", "list"]);
      requests.length = 0;
      rows = ["new", ...rows];
      pause = new Promise<void>((resolve) => { resume = resolve; });
      const refresh = observer.refetch({ cancelRefetch: false });
      expect(client.getQueryData(["relation", "list"])).toBe(before);
      resume();
      await refresh;
      expect(requests).toEqual([1, 2]);
      expect(observer.getCurrentResult().data?.pageParams).toEqual([1, 2]);
      await observer.fetchNextPage({ cancelRefetch: false });
      expect(observer.getCurrentResult().data?.pages.flatMap((page) => page.items)).toEqual(["new", "a", "b", "c", "d", "e"]);
    } finally { client.clear(); }
  });

  it("轮询不会取消正在执行的下一页请求", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resume!: () => void;
    const requests: number[] = [];
    const observer = new InfiniteQueryObserver(client, {
      queryKey: ["relation", "list"], enabled: false, initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        requests.push(pageParam);
        if (pageParam === 2) await new Promise<void>((resolve) => { resume = resolve; });
        return { page: pageParam, items: [`entity-${pageParam}`] };
      },
      getNextPageParam: (page) => page.page + 1,
    });
    try {
      await observer.refetch();
      const next = observer.fetchNextPage({ cancelRefetch: false });
      const refresh = observer.refetch({ cancelRefetch: false });
      resume();
      await Promise.all([next, refresh]);
      expect(requests).toEqual([1, 2]);
      expect(observer.getCurrentResult().data?.pageParams).toEqual([1, 2]);
    } finally { client.clear(); }
  });
});
