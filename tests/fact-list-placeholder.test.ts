import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn((options: unknown) => options),
  state: { mode: "fact" },
  result: {} as Record<string, unknown>,
  effects: [] as (() => void)[],
}));

vi.mock("react", () => ({
  useEffect: (effect: () => (() => void)) => mocks.effects.push(effect()),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [initial, () => {}],
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: object) => {
    mocks.query(options);
    return { ...options, ...mocks.result };
  },
  useQueryClient: () => ({ setQueryData: vi.fn() }),
  keepPreviousData: (previous: unknown) => previous,
}));
vi.mock("../src/store", () => ({
  useDashboardStore: (selector: (state: unknown) => unknown) => selector(mocks.state),
}));
vi.mock("../src/api/request", () => ({ notifyRequestError: vi.fn(), request: vi.fn(async () => ({ data: { items: [], total: 0 } })) }));

import { useFactList as runFactList, useFactPoints } from "../src/hooks/useFactQueries";
import type { FactRequest } from "../src/api/fact";

const fact = (factId: string, provinceCode: string) => ({
  factId,
  geo: {
    regionPath: [
      { name: "中国", code: "CHN" },
      { name: provinceCode, code: provinceCode },
    ],
  },
});

const factIds = (items?: { factId: string }[]) => items?.map((item) => item.factId);

const lastQueryOptions = () =>
  mocks.query.mock.calls.at(-1)![0] as { placeholderData?: unknown };

describe("事实列表占位数据", () => {
  beforeEach(() => {
    mocks.query.mockClear();
    mocks.state.mode = "fact";
  });

  it("上一组区域的结果在占位期间原样保留，不会因新区域被清空", () => {
    // 广东的卡片 + 刚切到湖南：若再按新区域裁剪，列表会整屏清空闪一下。
    mocks.result = {
      data: { items: [fact("a", "CN-GD"), fact("b", "CN-GD")], total: 2 },
      isPending: false,
      isFetching: true,
      isPlaceholderData: true,
      isError: false,
    };
    const list = runFactList({ view: "hunan", Province: "CN-HN" }, true);
    expect(factIds(list.data?.items)).toEqual(["a", "b"]);
  });

  it("真实结果到达后完整展示接口数据，不再按区域裁剪", () => {
    mocks.result = {
      data: { items: [fact("a", "CN-HN"), fact("b", "CN-GD")], total: 2 },
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      isError: false,
    };
    const list = runFactList({ view: "hunan", Province: "CN-HN" }, true);
    expect(factIds(list.data?.items)).toEqual(["a", "b"]);
  });

  it("仅在查询启用时保留上一批数据", () => {
    mocks.result = {
      data: { items: [], total: 0 },
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      isError: false,
    };
    runFactList({} as FactRequest, true);
    expect(typeof lastQueryOptions().placeholderData).toBe("function");

    runFactList({} as FactRequest, false);
    expect(lastQueryOptions().placeholderData).toBeUndefined();
  });
});


it("全不选仍调用列表和地图接口，清空条件后不会被缓存新鲜期跳过", async () => {
  const { request } = await import("../src/api/request");
  vi.mocked(request).mockClear();
  for (const params of [{ CategoryIds: [] }, {}]) {
    runFactList(params);
    useFactPoints(params);
    for (const [options] of mocks.query.mock.calls.slice(-2)) {
      const query = options as { enabled: boolean; staleTime: number; queryFn: () => Promise<unknown> };
      expect(query.enabled).toBe(true);
      expect(query.staleTime).toBe(0);
      await query.queryFn();
    }
  }
  expect(vi.mocked(request).mock.calls.map(([options]) => [options.url, options.data])).toEqual([
    ["/facts", { categoryIds: [], page: 1, pageSize: 30 }],
    ["/facts/points", { categoryIds: [] }],
    ["/facts", { page: 1, pageSize: 30 }],
    ["/facts/points", {}],
  ]);
});
