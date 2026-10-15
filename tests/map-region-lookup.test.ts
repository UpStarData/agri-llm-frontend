import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { findBoundaryAt, getBoundaryBounds, mergeChinaBoundaries } from "../src/utils/map";
import type { Boundary, Boundaries, Position } from "../src/types";

const boundary = (
  regionId: string,
  coordinates: Boundary["geometry"]["coordinates"],
  type: Boundary["geometry"]["type"] = "Polygon",
): Boundary => ({
  type: "Feature",
  properties: { name: regionId, regionId },
  geometry: { type, coordinates },
} as Boundary);

const collection = (...features: Boundary[]): Boundaries => ({
  type: "FeatureCollection",
  features,
});

const square = (regionId: string, [west, south]: [number, number], [east, north]: [number, number]) =>
  boundary(regionId, [[[west, south], [east, south], [east, north], [west, north], [west, south]]]);

const world = mergeChinaBoundaries(
  JSON.parse(readFileSync("public/boundaries/world.geojson", "utf8")) as Boundaries,
);
const china = JSON.parse(
  readFileSync("public/boundaries/china.geojson", "utf8"),
) as Boundaries;

describe("区域命中判定", () => {
  it("外接矩形覆盖要素的全部顶点", () => {
    expect(getBoundaryBounds(square("A", [10, 20], [30, 40]))).toEqual([[10, 20], [30, 40]]);
    const multi = boundary("B", [
      square("B", [0, 0], [1, 1]).geometry.coordinates,
      square("B", [-5, 8], [-2, 9]).geometry.coordinates,
    ], "MultiPolygon");
    expect(getBoundaryBounds(multi)).toEqual([[-5, 0], [1, 9]]);
  });

  it("洞里的点不算命中，环上与非洞区域才算", () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole: [number, number][] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    const data = collection(boundary("A", [ring, hole]));
    expect(findBoundaryAt(data, [5, 5])).toBeUndefined();
    expect(findBoundaryAt(data, [1, 1])?.properties.regionId).toBe("A");
  });

  it("岛屿落在大陆矩形里时取更紧凑的一块", () => {
    const data = collection(
      square("MAIN", [0, 0], [10, 10]),
      square("ISLE", [2, 2], [3, 3]),
    );
    expect(findBoundaryAt(data, [2.5, 2.5])?.properties.regionId).toBe("ISLE");
    expect(findBoundaryAt(data, [8, 8])?.properties.regionId).toBe("MAIN");
  });

  it("真实边界：省、合并后的中国与海面", () => {
    expect(findBoundaryAt(china, [112.9, 28.2])?.properties.regionId).toBe("430000");
    // 港澳台在世界层已合并进中国，点上去应当整体高亮同一个要素。
    const inChina: Position[] = [[114.16, 22.28], [113.52, 22.23], [120.73, 23.73], [121.5, 25.05], [112, 30]];
    for (const point of inChina)
      expect(findBoundaryAt(world, point)?.properties.regionId).toBe("CN");
    expect(findBoundaryAt(world, [0, -40])).toBeUndefined();
  });
});
