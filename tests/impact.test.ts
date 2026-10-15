import { describe, expect, it } from "vitest";
import { EARTH_RADIUS_KM, impactCircle, mapScale, distanceKm } from "../src/utils/impact";
import {
  createInfluenceLayers,
  influenceCenters,
  influenceRingSegments,
} from "../src/utils/mapLayers";
import type { FactPoint } from "../src/api/fact";
import type { Position } from "../src/types";

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
      layers.find((layer) => layer.id === "overlay-influence-boundary")?.props
        .data,
    ).toEqual([{ geoPoint: [112, 28], radiusKm: 25 }]);
  });
  it("同一坐标的多条事实只画一组圈，半径取最大", () => {
    const centers = influenceCenters([
      { factId: "a", geoPoint: [112, 28], impactRadiusKm: 40 },
      { factId: "b", geoPoint: [112, 28], impactRadiusKm: 130 },
      { factId: "c", geoPoint: [112, 28], impactRadiusKm: 80 },
    ], 10);
    expect(centers).toEqual([{ geoPoint: [112, 28], radiusKm: 130 }]);
  });
  it("屏幕上挤在一起的圆心并成一片，落在半径最大的一条上", () => {
    // 两点相距约 90km；10km/px 时同屏只差 9px，圈已经叠在一起。
    expect(distanceKm([112, 28], [112.9, 28])).toBeLessThan(24 * 10);
    const centers = influenceCenters([
      { factId: "a", geoPoint: [112, 28], impactRadiusKm: 100 },
      { factId: "b", geoPoint: [112.9, 28], impactRadiusKm: 60 },
    ], 10);
    expect(centers).toEqual([{ geoPoint: [112, 28], radiusKm: 100 }]);
  });
  it("分开的圆心各自保留自己的圈，缩进来看不再合并", () => {
    const points: FactPoint[] = [
      { factId: "a", geoPoint: [112, 28], impactRadiusKm: 60 },
      { factId: "b", geoPoint: [112.9, 28], impactRadiusKm: 60 },
    ];
    expect(influenceCenters(points, 10)).toHaveLength(1);
    // 0.2km/px 时同样的两点相隔 440px，是两个独立的圈。
    expect(influenceCenters(points, 0.2)).toHaveLength(2);
    expect(distanceKm([112, 28], [130, 45])).toBeGreaterThan(24 * 10);
    expect(influenceCenters([
      { factId: "a", geoPoint: [112, 28], impactRadiusKm: 60 },
      { factId: "b", geoPoint: [130, 45], impactRadiusKm: 60 },
    ], 10)).toHaveLength(2);
  });
  it("影响圆按屏幕尺寸采样：小圆少切几段，大圆不超过上限", () => {
    const points: FactPoint[] = [{ factId: "r", geoPoint: [112, 28], impactRadiusKm: 176 }];
    // 球体上 176km 的影响圆只有几像素，不应该再切 96 段。
    const tiny = createInfluenceLayers(points, 0, false, "dark", 40)[0];
    expect((tiny.props.getPath as (c: unknown) => Position[])(tiny.props.data[0])).toHaveLength(13);
    // 放大到省级视角后同一个圆很大，保持 96 段上限。
    const large = createInfluenceLayers(points, 0, false, "dark", 0.05)[0];
    expect((large.props.getPath as (c: unknown) => Position[])(large.props.data[0])).toHaveLength(97);
    expect(influenceRingSegments(1, 1000)).toBe(12);
    expect(influenceRingSegments(250, 0.05)).toBe(96);
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
