import { beforeEach, describe, expect, it, vi } from "vitest";
import { _GlobeViewport as GlobeViewport, WebMercatorViewport } from "@deck.gl/core";
import type { GeoPoint } from "../src/api/fact";

const state = vi.hoisted(() => ({
  mode: "fact", level: "world", colorTheme: "light",
  mapOverlayVisibility: { ports: true, influence: false },
  relationGlow: { entityIds: [], relationIds: [], until: 0 },
  select: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useState: () => [0, vi.fn()],
  useEffect: () => {},
}));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector) => selector }));
vi.mock("../src/store", () => ({ useDashboardStore: (selector) => selector(state) }));
vi.mock("../src/hooks/useFactIntensityAnimation", () => ({
  useFactIntensityAnimation: () => ({ hidePoints: false, seconds: undefined }),
}));

import { useMapLayers } from "../src/hooks/useMapLayers";
import GeoPointInfoCard from "../src/components/map/GeoPointInfoCard";

const point: GeoPoint = {
  pointId: "hormuz", name: "霍尔木兹海峡", kind: "risk", geoPoint: [56.5, 26.5],
  description: "波斯湾通往印度洋的唯一海上通道。",
};
const camera = { longitude: 56.5, latitude: 26.5, zoom: 3 };

describe("叠加图标简要信息", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([false, true])("点击图标只展示现有点位信息，并阻止地图跳转（球面：%s）", (isGlobe) => {
    const onGeoPointClick = vi.fn();
    const changeRegion = vi.fn();
    const setIsGlobe = vi.fn();
    const layers = useMapLayers({
      geoPoints: [point], onGeoPointClick, camera, width: 1000, height: 700,
      isGlobe, flatWorld: !isGlobe, paused: true, changeRegion, setIsGlobe,
      factsPending: false,
    });
    const layer = layers.find((item) => item?.id === "fact-geo-points")!;
    const handled = layer.props.onClick!({ object: point } as never, {} as never);
    expect(handled).toBe(true);
    expect(onGeoPointClick).toHaveBeenCalledExactlyOnceWith(point);
    expect(state.select).not.toHaveBeenCalled();
    expect(changeRegion).not.toHaveBeenCalled();
    expect(setIsGlobe).not.toHaveBeenCalled();
  });

  it("名称、简介使用点位数据，分类使用叠加分类，卡片位于图标上方并可关闭", () => {
    const viewport = new WebMercatorViewport({ ...camera, width: 1000, height: 700 });
    const onClose = vi.fn();
    const card = GeoPointInfoCard({ point, viewport, onClose })!;
    expect(card.props.children.props.items).toEqual([
      { key: "name", label: "名称", children: point.name },
      { key: "category", label: "分类", children: "地缘风险区" },
      { key: "description", label: "简介", children: point.description },
    ]);
    expect(card.props.style.top).toBeCloseTo(viewport.project(point.geoPoint)[1] - 18);
    expect(card.props.style.transform).toBe("translate(-50%, -100%)");
    card.props.extra.props.onClick();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("缺少简介时展示占位文案", () => {
    const viewport = new WebMercatorViewport({ ...camera, width: 1000, height: 700 });
    const card = GeoPointInfoCard({ point: { ...point, description: null }, viewport, onClose: vi.fn() })!;
    expect(card.props.children.props.items[2].children).toBe("暂无简介");
  });

  it("地图平移后卡片跟随点位；球体背面不显示卡片", () => {
    const viewport = new WebMercatorViewport({ ...camera, longitude: 60, width: 1000, height: 700 });
    const card = GeoPointInfoCard({ point, viewport, onClose: vi.fn() })!;
    expect(card.props.style.left).toBeCloseTo(viewport.project(point.geoPoint)[0]);
    const backside = new GlobeViewport({ ...camera, longitude: -123.5, latitude: -26.5, width: 1000, height: 700 });
    expect(GeoPointInfoCard({ point, viewport: backside, onClose: vi.fn() })).toBeNull();
  });
});
