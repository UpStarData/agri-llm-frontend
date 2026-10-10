import { afterEach, describe, expect, it, vi } from "vitest";
import { WebMercatorViewport } from "@deck.gl/core";
import { clampFlatView, getGlobeZoomLimits, getRegionView, isGlobeMaxZoom } from "../src/utils/map";
import { getLandColor } from "../src/utils/mapLayers";
import { readTheme } from "../src/utils/theme";

afterEach(() => vi.unstubAllGlobals());

describe("地图外观与相机边界", () => {
  it("没有主题偏好或存储不可用时默认亮色，保留用户的暗色选择", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(readTheme()).toBe("light");
    vi.stubGlobal("localStorage", { getItem: () => "dark" });
    expect(readTheme()).toBe("dark");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("unavailable"); } });
    expect(readTheme()).toBe("light");
  });

  it.each([[1440, 900], [1920, 680], [490, 850]])("%s × %s 下平移保留操作空间且不会无限循环", (width, height) => {
    const center = getRegionView("world", undefined, undefined, width, height);
    const viewport = new WebMercatorViewport({ ...center, width, height });
    const within = { ...center, longitude: center.longitude + 5, latitude: center.latitude + 2 };
    expect(clampFlatView(within, center, width, height)).toMatchObject(within);
    const east = clampFlatView({ ...center, longitude: 1000, latitude: 89 }, center, width, height);
    const west = clampFlatView({ ...center, longitude: -1000, latitude: -89 }, center, width, height);
    expect(east.longitude).toBeGreaterThan(center.longitude);
    expect(east.longitude).toBeLessThanOrEqual(center.longitude + 90);
    expect(west.longitude).toBeLessThan(center.longitude);
    expect(west.longitude).toBeGreaterThanOrEqual(center.longitude - 90);
    expect(east.latitude).toBeCloseTo(viewport.unproject([width / 2, height * 0.25])[1]);
    expect(west.latitude).toBeCloseTo(viewport.unproject([width / 2, height * 0.75])[1]);
    expect(clampFlatView(east, center, width, height)).toEqual(east);
  });

  it("国家视角的平移围绕该区域限制，缩放级别不受平移影响", () => {
    const center = getRegionView("country", "CN", undefined, 1440, 900);
    const view = clampFlatView({ ...center, zoom: center.zoom + 2, longitude: -500 }, center, 1440, 900);
    expect(view.longitude).toBeGreaterThan(0);
    expect(view.zoom).toBe(center.zoom + 2);
  });

  it.each([0, 45, 80, -60])("纬度 %s 的球体达到对应缩放上限才切换", (latitude) => {
    const { maxZoom } = getGlobeZoomLimits(1440, 900, latitude);
    expect(isGlobeMaxZoom({ longitude: 105, latitude, zoom: maxZoom - 0.1 }, 1440, 900)).toBe(false);
    expect(isGlobeMaxZoom({ longitude: 105, latitude, zoom: maxZoom }, 1440, 900)).toBe(true);
  });

  it("主要相邻区域使用不同填色，并适配明暗主题", () => {
    expect(getLandColor("CN", "light")).not.toEqual(getLandColor("RU", "light"));
    expect(getLandColor("CN", "light")).not.toEqual(getLandColor("CN", "dark"));
  });
});
