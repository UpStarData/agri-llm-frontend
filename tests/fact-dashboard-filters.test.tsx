import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  excluded: [] as string[],
  dates: ["2026-10-01", "2026-10-16"] as [string, string] | null,
  // 地图取景（level/regionId）与左侧区域筛选（countryId/provinceId）各自独立。
  region: {
    level: "world",
    regionId: undefined as string | undefined,
    countryId: "",
    provinceId: "",
  },
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
  factFilters: {
    countryId: mocks.region.countryId,
    provinceId: mocks.region.provinceId,
    varieties: [], keyword: "", videoOnly: false,
  },
  dateRange: mocks.dates, level: mocks.region.level, regionId: mocks.region.regionId,
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
    mocks.region = { level: "world", regionId: undefined, countryId: "", provinceId: "" };
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

describe("区域条件只看左侧区域筛选", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dates = ["2026-10-01", "2026-10-16"];
  });

  it("地图放大缩小切到省份取景，列表、星点和实时刷新都不改视角", () => {
    mocks.region = { level: "province", regionId: "440000", countryId: "", provinceId: "" };
    Dashboard();
    for (const hook of [mocks.list, mocks.points]) {
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({ view: "global", Province: undefined }),
      );
    }
    expect(mocks.live).toHaveBeenCalledWith(
      expect.objectContaining({ view: "global", Province: undefined }),
      true,
    );
  });

  it("左侧选中省份时列表与地图一起切到该省", () => {
    mocks.region = { level: "world", regionId: undefined, countryId: "CN", provinceId: "440000" };
    Dashboard();
    for (const hook of [mocks.list, mocks.points]) {
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({ view: "china", Province: "CN-GD" }),
      );
    }
  });
});
