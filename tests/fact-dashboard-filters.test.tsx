import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  excluded: [] as string[],
  dates: ["2026-10-01", "2026-10-16"] as [string, string] | null,
  list: vi.fn(() => ({})),
  points: vi.fn(() => ({ data: [{ factId: "server-point" }] })),
  live: vi.fn(() => ({ ids: [] })),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector) => selector }));
vi.mock("../src/store", () => ({ useDashboardStore: (selector) => selector({
  mode: "fact", relationContext: null,
  drawerOpen: { fact: { right: true, bottom: false } },
  excludedFilterIds: { fact: mocks.excluded },
  factFilters: { countryId: "", provinceId: "", varieties: [], keyword: "", videoOnly: false },
  dateRange: mocks.dates, level: "world",
}) }));
vi.mock("../src/hooks", () => ({
  useFactList: mocks.list, useFactPoints: mocks.points,
  useFactTaxonomy: () => ({ data: { groups: [{
    id: "group", categories: [{ id: "category", types: [{ id: "leaf" }] }],
  }] } }),
}));
vi.mock("../src/hooks/useFactLive", () => ({ useFactLive: mocks.live }));
vi.mock("../src/hooks/useRelationQueries", () => ({
  useRelationCatalogs: () => ({ categories: {}, types: {} }),
  useRelationQueries: () => ({ graph: {}, map: {}, list: {} }),
}));
vi.mock("../src/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("../src/components/FactMenu", () => ({ default: () => null }));
vi.mock("../src/pages/Dashboard/component/RelationMenu", () => ({ default: () => null }));
vi.mock("../src/pages/Dashboard/component/EntityList", () => ({ default: () => null }));
vi.mock("../src/components/DetailDrawer", () => ({ default: () => null }));
vi.mock("../src/components/LeftLayerDrawer", () => ({ default: () => null }));
vi.mock("../src/components/RightRecordsDrawer", () => ({ default: () => null }));
vi.mock("../src/pages/Dashboard/component/ProcessingLog", () => ({ default: () => null }));

import Dashboard from "../src/pages/Dashboard";

describe("事实层分类操作", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dates = ["2026-10-01", "2026-10-16"];
  });

  it("反选取消全部仍启用列表、地图及实时刷新，空分类数组透传", () => {
    mocks.excluded = ["leaf"];
    const dashboard = Dashboard();
    for (const hook of [mocks.list, mocks.points]) {
      expect(hook).toHaveBeenCalledWith(expect.objectContaining({ CategoryIds: [] }));
    }
    expect(mocks.live).toHaveBeenCalledWith(expect.objectContaining({ CategoryIds: [] }), true);
    const map = dashboard.props.children[1].props.children[0].props.children;
    expect(map.props.points).toEqual([{ factId: "server-point" }]);
  });

  it("恢复全选移除分类限制，继续使用查询接口", () => {
    mocks.excluded = [];
    Dashboard();
    for (const hook of [mocks.list, mocks.points]) {
      expect(hook).toHaveBeenCalledWith(expect.objectContaining({ CategoryIds: undefined }));
    }
  });
});

it("全部时间向列表、地图和实时刷新传 all，不依赖后端默认范围", () => {
  vi.clearAllMocks();
  mocks.dates = null;
  Dashboard();
  for (const hook of [mocks.list, mocks.points]) {
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ TimeRange: "all" }));
  }
  expect(mocks.live).toHaveBeenCalledWith(expect.objectContaining({ TimeRange: "all" }), true);
});
