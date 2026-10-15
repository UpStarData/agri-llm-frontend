import { readFileSync } from "node:fs";
import { ScatterplotLayer } from "@deck.gl/layers";
import { mergeChinaBoundaries, getMapPointScale } from "../src/utils/map";
import { applyFactPointLayout, createMapLayers, FACT_POINT_RADIUS } from "../src/utils/mapLayers";
import type { Boundaries, MapLevel } from "../src/types";
import { describe, expect, it } from "vitest";
import { layoutFactPoints } from "../src/utils/factPointLayout";
import { createGlobeSurface } from "../src/utils/globeSurface";
import type { FactPoint } from "../src/api/fact";

describe("事实点位展开与球面遮挡", () => {
  it("500 条同坐标事实保持全部可区分，原始坐标不变，顺序变化不影响布局", () => {
    const points: FactPoint[] = Array.from({ length: 500 }, (_, i) => ({ factId: String(i), geoPoint: [112, 28] }));
    const layout = layoutFactPoints(points, (p) => p, (p) => p);
    expect(layout.size).toBe(500);
    expect(new Set([...layout.values()].map((p) => p.join(","))).size).toBe(500);
    const reversed = layoutFactPoints([...points].reverse(), (p) => p, (p) => p);
    for (const point of points) {
      expect(point.geoPoint).toEqual([112, 28]);
      expect(layout.get(point)).toEqual(reversed.get(point));
    }
  });
  it("独立点位保持原位，无法反投影时保留原坐标", () => {
    const points: FactPoint[] = [{ factId: "a", geoPoint: [0, 0] }, { factId: "b", geoPoint: [1, 1] }];
    expect(layoutFactPoints(points, (p) => p, (p) => p).size).toBe(0);
    expect(layoutFactPoints([points[0], { ...points[0], factId: "c" }], (p) => p, () => [NaN, NaN]).size).toBe(0);
  });
  it("球面背面点和无效投影不展开，避免把背面点移动到正面", () => {
    const points: FactPoint[] = [{ factId: "a", geoPoint: [112, 28] }, { factId: "b", geoPoint: [112, 28] }];
    expect(layoutFactPoints(points, (p) => p, (p) => p, () => false).size).toBe(0);
    expect(layoutFactPoints(points, () => [NaN, NaN], (p) => p).size).toBe(0);
  });
  it.each(["dark", "light"] as const)("%s 海洋覆盖整个球面，写入深度且不参与拾取", (theme) => {
    const layer = createGlobeSurface(theme);
    expect(layer.props.parameters).toMatchObject({ depthWriteEnabled: true, depthCompare: "less-equal" });
    expect(layer.props.pickable).toBe(false);
    expect(layer.props.getFillColor).toHaveLength(4);
    expect((layer.props.getFillColor as number[])[3]).toBe(255);
    const data = layer.props.data as { features: { geometry: { coordinates: number[][][] } }[] };
    expect(data.features).toHaveLength(648);
    const positions = data.features.flatMap((f) => f.geometry.coordinates[0]);
    expect(Math.min(...positions.map((p) => p[0]))).toBe(-180);
    expect(Math.max(...positions.map((p) => p[0]))).toBe(180);
    expect(Math.min(...positions.map((p) => p[1]))).toBe(-90);
    expect(Math.max(...positions.map((p) => p[1]))).toBe(90);
  });
  it("重叠展开只改位置：同一区域层级的事实点半径一致，大小只随层级缩放", () => {
    const points: FactPoint[] = [
      { factId: "a", geoPoint: [112, 28] },
      { factId: "b", geoPoint: [112, 28] },
      { factId: "c", geoPoint: [120, 30] },
    ];
    const factLayer = (layers: ReturnType<typeof createMapLayers>) =>
      layers.find((item) => item.id === "real-facts") as ScatterplotLayer<FactPoint>;
    const base = (level: MapLevel) => createMapLayers({
      mode: "fact", colorTheme: "dark", level, points,
      select: () => {}, selectProvince: () => {},
    });
    // 展开只发生在同坐标的 a、b 上，c 保持原位。
    const layout = layoutFactPoints(points, (p) => p, (p) => p);
    expect(layout.size).toBe(2);
    for (const level of ["world", "country", "province"] as const) {
      const layers = base(level);
      const spread = factLayer(applyFactPointLayout(layers, layout, getMapPointScale(level), false));
      // 半径是常量，不因点位、是否被展开而分档。
      expect(spread.props.getRadius).toBe(FACT_POINT_RADIUS);
      expect(spread.props.getRadius).toBe(factLayer(layers).props.getRadius);
      expect(spread.props.radiusScale).toBe(getMapPointScale(level));
      const [a, b] = points;
      expect(spread.props.getPosition(b)).toEqual(layout.get(b));
      expect(spread.props.getPosition(a)).toEqual(layout.get(a));
      expect(factLayer(layers).props.getPosition(b)).toEqual([112, 28]);
    }
    // 层级之间的大小差异仍由 radiusScale 承担。
    expect(new Set(["world", "country", "province"].map((level) => getMapPointScale(level))).size)
      .toBeGreaterThan(1);
  });
});

// 使用实际边界文件，防止世界地图再次把台湾拆成独立的拾取对象。
it("中国各区域合并为同一个可高亮要素，保留全部多边形及原始数据", () => {
  const source = JSON.parse(readFileSync("public/boundaries/world.geojson", "utf8")) as Boundaries;
  const original = JSON.stringify(source);
  const result = mergeChinaBoundaries(source);
  const ids = new Set(["CN", "TW", "HK", "MO"]);
  const polygons = source.features.filter((f) => ids.has(f.properties.regionId))
    .flatMap((f) => f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
  const china = result.features.find((f) => f.properties.regionId === "CN")!;
  expect(china.geometry).toEqual({ type: "MultiPolygon", coordinates: polygons });
  expect(result.features.some((f) => ["TW", "HK", "MO"].includes(f.properties.regionId))).toBe(false);
  expect(JSON.stringify(source)).toBe(original);
  expect(mergeChinaBoundaries(result)).toEqual(result);
});
