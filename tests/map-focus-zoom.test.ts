import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getRegionView } from "../src/utils/map";
import type { Boundaries } from "../src/types";

const effects = vi.hoisted(() => [] as (() => unknown)[]);

// 与 map-camera-transition 相同的隔离方式：只验证缩放层级切换，不挂载浏览器事件。
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, () => {}],
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => unknown) => effects.push(effect),
  useLayoutEffect: () => {},
}));
import { useMapCamera } from "../src/hooks/useMapCamera";

const world = JSON.parse(
  readFileSync("public/boundaries/world.geojson", "utf8"),
) as Boundaries;
const china = JSON.parse(
  readFileSync("public/boundaries/china.geojson", "utf8"),
) as Boundaries;

const options = {
  mode: "fact" as const,
  width: 1440,
  height: 900,
  container: { current: null },
  setIsGlobe: vi.fn(),
  changeRegion: vi.fn(),
  world,
  china,
};
// 湖北（世界视角命中中国）与湖南（中国视角命中该省）各取一个锚点。
const inChina = [112, 30] as [number, number];
const inHunan = [112.9, 28.2] as [number, number];
const atSea = [0, -40] as [number, number];
const countryView = getRegionView("country", "CN", china, options.width, options.height, world);
const provinceView = getRegionView("province", "430000", china, options.width, options.height, world);

beforeEach(() => {
  vi.clearAllMocks();
  effects.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("地图放大下钻", () => {
  it("世界视角放大到中国取景缩放时聚焦中国", () => {
    const camera = useMapCamera({ ...options, level: "world", isGlobe: false });
    camera.setZoom({ ...countryView, zoom: countryView.zoom - 0.2 }, inChina);
    expect(options.changeRegion).not.toHaveBeenCalled();
    camera.setZoom({ ...countryView, zoom: countryView.zoom + 0.1 }, inChina);
    expect(options.changeRegion).toHaveBeenCalledExactlyOnceWith("CN");
  });

  it("中国视角放大到该省取景缩放时聚焦该省", () => {
    const camera = useMapCamera({ ...options, level: "country", regionId: "CN", isGlobe: false });
    camera.setZoom({ ...provinceView, zoom: provinceView.zoom - 0.2 }, inHunan);
    expect(options.changeRegion).not.toHaveBeenCalled();
    camera.setZoom({ ...provinceView, zoom: provinceView.zoom + 0.1 }, inHunan);
    expect(options.changeRegion).toHaveBeenCalledExactlyOnceWith("CN", "430000");
  });

  it("锚点落在海面上时不下钻", () => {
    const camera = useMapCamera({ ...options, level: "world", isGlobe: false });
    camera.setZoom({ ...countryView, zoom: countryView.zoom + 0.5 }, atSea);
    expect(options.changeRegion).not.toHaveBeenCalled();
  });

  it("缩小经过同一阈值不下钻", () => {
    const camera = useMapCamera({ ...options, level: "world", isGlobe: false });
    camera.setZoom({ ...countryView, zoom: countryView.zoom + 0.5 }, atSea);
    camera.setZoom({ ...countryView, zoom: countryView.zoom + 0.3 }, inChina);
    expect(options.changeRegion).not.toHaveBeenCalled();
  });

  it("没有省级数据的国家不再往下钻", () => {
    const camera = useMapCamera({ ...options, level: "country", regionId: "US", isGlobe: false });
    camera.setZoom({ longitude: -100, latitude: 40, zoom: 9, pitch: 0, bearing: 0 }, [-100, 40]);
    expect(options.changeRegion).not.toHaveBeenCalled();
  });

  it("球体放大不下钻，只更新相机", () => {
    const camera = useMapCamera({ ...options, level: "world", isGlobe: true });
    camera.setZoom({ ...countryView, zoom: 1.5 }, inChina);
    expect(options.setIsGlobe).not.toHaveBeenCalled();
    expect(options.changeRegion).not.toHaveBeenCalled();
  });
});
