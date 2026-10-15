import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn((options) => options),
  infiniteQuery: vi.fn((options) => options),
  state: {
    mode: "relation", factFilters: { varieties: [] as string[] },
    excludedFilterIds: { relation: [] as string[] },
    relationFilters: { excludedTypes: [] as string[], keyword: "", crossRegion: true },
    relationRevision: 0, level: "world", regionId: undefined as string | undefined,
  },
  request: vi.fn(),
  setQueryData: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.query, useInfiniteQuery: mocks.infiniteQuery, useQueryClient: () => ({ setQueryData: mocks.setQueryData }), keepPreviousData: (previous: unknown) => previous }));
vi.mock("../src/store", () => ({ useDashboardStore: (selector) => selector(mocks.state) }));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector) => selector }));
vi.mock("../src/api/request", () => ({ request: mocks.request, ApiError: class extends Error {} }));
import { useRelationQueries as runRelationQueries } from "../src/hooks/useRelationQueries";

const categoryId = "01a12521-7294-71a5-99f1-0ed778a2c0de";
const typeId = "01a12521-7294-71a5-99f1-0ed778a2428f";
const otherTypeId = "01a12521-7294-71a5-99f1-0ed6afccb5d4";
const categories = { version: "1", categories: [{ id: "group", name: "本体", children: [
  { id: categoryId, name: "市场", displayGroup: "market" },
] }] };
const types = { version: "1", types: [typeId, otherTypeId].map((id) => ({
  id, name: "关系", colorDomain: "production_supply", directed: true,
  sourceCategoryIds: [], targetCategoryIds: [],
})) };

function queries() {
  mocks.query.mockClear();
  mocks.infiniteQuery.mockClear();
  runRelationQueries(categories, types);
  return [
    ...mocks.query.mock.calls.map(([options]) => options).filter((options) => ["graph", "graph-points"].includes(options.queryKey[1])),
    mocks.infiniteQuery.mock.calls[0][0],
  ];
}

describe("关联层后端筛选", () => {
  beforeEach(() => {
    mocks.state.factFilters.varieties = [];
    mocks.state.excludedFilterIds.relation = [];
    mocks.state.relationFilters = { excludedTypes: [], keyword: "", crossRegion: true };
    mocks.state.level = "world";
    mocks.state.regionId = undefined;
    mocks.state.relationRevision = 0;
    mocks.request.mockReset();
    mocks.request.mockImplementation(async ({ url }) => url === "/entities"
      ? { code: 0, data: { items: [], total: 0, page: 1 } }
      : { code: 0, data: { nodes: [], edges: [], total: 0, returned: 0, truncated: false } });
  });

  it("轮播结束只保留第一页后刷新，筛选查询键不变", async () => {
    const refetch = vi.fn(async () => ({}));
    mocks.infiniteQuery.mockImplementationOnce((options) => ({ ...options, refetch }));
    const result = runRelationQueries(categories, types);
    await result.refreshList();
    const [key, trim] = mocks.setQueryData.mock.lastCall!;
    expect(key[0]).toBe("relation");
    expect(key[1]).toBe("list");
    const pages = [{ items: [{ entityId: "a" }] }, { items: [{ entityId: "b" }] }];
    expect(trim({ pages, pageParams: [1, 2] })).toEqual({ pages: [pages[0]], pageParams: [1] });
    expect(trim(undefined)).toBeUndefined();
    expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  it("三个请求统一传入目录关系 ID、本体分类、品种和搜索条件", async () => {
    mocks.state.relationFilters = { excludedTypes: [otherTypeId], keyword: "市场", crossRegion: true };
    mocks.state.factFilters.varieties = ["commodity"];
    for (const query of queries()) {
      expect(query.enabled).toBe(true);
      await query.queryFn({ pageParam: 1 });
    }
    expect(mocks.request.mock.calls.map(([request]) => request.url)).toEqual(["/graph", "/graph/points", "/entities"]);
    for (const [request] of mocks.request.mock.calls) {
      expect(request.data).toMatchObject({ categoryIds: [categoryId], commodityIds: ["commodity"], relationTypeIds: [typeId], q: "市场" });
      expect(request.data).not.toHaveProperty("relationTypes");
    }
  });

  it("分类、关系和品种变化都更新三个查询键，恢复原筛选也重新请求", () => {
    let previous = queries();
    const changes = [
      () => { mocks.state.excludedFilterIds.relation = [categoryId]; },
      () => { mocks.state.relationFilters.excludedTypes = [typeId, otherTypeId]; },
      () => { mocks.state.factFilters.varieties = ["commodity"]; },
      () => { mocks.state.excludedFilterIds.relation = []; },
      () => { mocks.state.relationFilters.excludedTypes = []; },
    ];
    for (const change of changes) {
      change();
      const next = queries();
      next.forEach((query, index) => {
        expect(query.queryKey).not.toEqual(previous[index].queryKey);
        expect(query.staleTime).toBe(0);
        expect(query.enabled).toBe(true);
      });
      previous = next;
    }
  });

  it.each([
    ["world", undefined, "global"],
    ["country", "CN", "china"],
    ["province", "430000", "hunan"],
    ["country", "CL", "global"],
  ])("地图层级 %s/%s 请求 %s，跨区域开关只刷新地图查询", async (level, regionId, view) => {
    const initial = queries();
    mocks.state.level = level!;
    mocks.state.regionId = regionId;
    const enabled = queries();
    await enabled[1].queryFn();
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/graph/points", data: expect.objectContaining({ view, includeCrossRegion: true }),
    }));
    mocks.state.relationFilters.crossRegion = false;
    const disabled = queries();
    expect(disabled[1].queryKey).not.toEqual(enabled[1].queryKey);
    expect(disabled[0].queryKey).toEqual(initial[0].queryKey);
    expect(disabled[2].queryKey).toEqual(initial[2].queryKey);
    await disabled[1].queryFn();
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ view, includeCrossRegion: false }),
    }));
  });

  it("全不选时仍请求后端并传空数组，业务错误 51 不作为列表数据展示", async () => {
    mocks.state.excludedFilterIds.relation = [categoryId];
    mocks.state.relationFilters.excludedTypes = [typeId, otherTypeId];
    for (const query of queries()) await query.queryFn({ pageParam: 1 });
    for (const [request] of mocks.request.mock.calls)
      expect(request.data).toMatchObject({ categoryIds: [], relationTypeIds: [] });
    mocks.request.mockResolvedValue({ code: 51, message: "无效筛选", data: null });
    for (const query of queries())
      await expect(query.queryFn({ pageParam: 1 })).rejects.toThrow("无效筛选");
  });
});
