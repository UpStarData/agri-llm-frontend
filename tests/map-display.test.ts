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
});
