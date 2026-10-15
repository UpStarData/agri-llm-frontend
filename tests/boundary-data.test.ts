import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mergeChinaBoundaries } from "../src/utils/map";
import type { Boundaries } from "../src/types";

const world = JSON.parse(
  readFileSync("public/boundaries/world.geojson", "utf8"),
) as Boundaries;

const verticesOf = (node: unknown): number => {
  if (!Array.isArray(node)) return 0;
  if (typeof node[0] === "number" && typeof node[1] === "number") return 1;
  return node.reduce<number>((sum, child) => sum + verticesOf(child), 0);
};

describe("世界边界数据精度", () => {
  it("使用 Natural Earth 1:50m，顶点足以画出海岸线", () => {
    // 1:110m 只有 177 个要素、1.07 万顶点，海岸线会被拉成直线。
    expect(world.features.length).toBeGreaterThan(200);
    const vertices = world.features.reduce(
      (sum, feature) => sum + verticesOf(feature.geometry.coordinates),
      0,
    );
    expect(vertices).toBeGreaterThan(50_000);
  });

  it("小岛屿不再缺失，且都有可用的 regionId", () => {
    const regionIds = new Set(world.features.map((feature) => feature.properties.regionId));
    // 香港、澳门、新加坡、马耳他、马尔代夫在 1:110m 里整块丢失，放大后是一片空白。
    for (const regionId of ["HK", "MO", "SG", "MT", "MV"]) expect(regionIds).toContain(regionId);
    expect([...regionIds].every((regionId) => typeof regionId === "string" && regionId.length > 1)).toBe(true);
    expect(regionIds.has("-99")).toBe(false);
  });

  it("保留南极洲供平面视角过滤，且中国各区域能合并成一块", () => {
    expect(world.features.some((feature) => feature.properties.name === "Antarctica")).toBe(true);
    const merged = mergeChinaBoundaries(world);
    expect(merged.features.filter((feature) => ["CN", "TW", "HK", "MO"].includes(feature.properties.regionId))).toHaveLength(1);
  });
});
