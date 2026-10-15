import { afterEach, describe, expect, it, vi } from "vitest";
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

  it.each([[1440, 900], [1920, 680], [490, 850]])("%s × %s 下允许连续跨越日期变更线", (width, height) => {
    const center = getRegionView("world", undefined, undefined, width, height);
    for (const longitude of [-1000, -181, 181, 1000]) {
      const view = clampFlatView({ ...center, longitude, latitude: 89 });
      expect(view.longitude).toBe(longitude);
      expect(view.latitude).toBe(85);
      expect(view.zoom).toBe(center.zoom);
    }
  });

  it.each([[0, 0], [1, 1], [32, 64], [64, 32], [NaN, Infinity]])("%s × %s 的临时容器尺寸不会导致 fitBounds 断言失败", (width, height) => {
    for (const level of ["world", "country", "province"] as const) {
      const view = getRegionView(level, undefined, undefined, width, height);
      expect(Number.isFinite(view.zoom)).toBe(true);
      expect(Number.isFinite(view.minZoom)).toBe(true);
    }
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
