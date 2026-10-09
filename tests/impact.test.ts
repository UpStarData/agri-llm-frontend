import { describe, expect, it } from "vitest";
import { EARTH_RADIUS_KM, impactCircle, mapScale } from "../src/utils/impact";
import { createInfluenceLayers } from "../src/utils/mapLayers";
import type { FactPoint } from "../src/api/fact";

describe("事实地理影响范围", () => {
  it("不同纬度和跨日期变更线的边界距圆心均为接口半径", () => {
    for (const center of [
      [112, 28],
      [179.9, 60],
      [-60, -35],
    ] as [number, number][]) {
      const ring = impactCircle(center, 250);
      for (const point of ring) {
        const rad = Math.PI / 180;
        const a =
          Math.sin(((point[1] - center[1]) * rad) / 2) ** 2 +
          Math.cos(center[1] * rad) *
            Math.cos(point[1] * rad) *
            Math.sin(((point[0] - center[0]) * rad) / 2) ** 2;
        expect(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))).toBeCloseTo(
          250,
          6,
        );
      }
      expect(ring[0][0]).toBeCloseTo(ring[96][0]);
      expect(ring[0][1]).toBeCloseTo(ring[96][1]);
    }
  });
  it("仅 facts/points 的有效正半径参与绘制", () => {
    const points: FactPoint[] = [null, undefined, 0, -1, NaN, 25].map(
      (impactRadiusKm, index) => ({
        factId: String(index),
        geoPoint: [112, 28],
        impactRadiusKm,
      }),
    );
    const layers = createInfluenceLayers(points, 0, false);
    expect(
      layers.find((layer) => layer.id === "overlay-influence-ring-3")?.props
        .data,
    ).toEqual([points[5]]);
  });
  it("比例尺随缩放变化并保持可见宽度", () => {
    expect(mapScale(5, 30, false).label).not.toBe(mapScale(8, 30, false).label);
    for (const flat of [true, false]) {
      const scale = mapScale(5, 30, flat);
      expect(scale.pixels).toBeGreaterThan(30);
      expect(scale.pixels).toBeLessThanOrEqual(100);
    }
  });
});
