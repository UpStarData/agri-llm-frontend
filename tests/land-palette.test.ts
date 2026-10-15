import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ECOLOGY_THEME as eco } from "../src/utils/ecologyTheme";
import { regionColorIndices } from "../src/utils/regionColoring";
import { createMapLayers, getLandColor } from "../src/utils/mapLayers";
import type { Boundaries, ColorTheme } from "../src/types";

const SPEC_PALETTE = [
  "#CFE9BD", // 浅草绿（默认陆地）
  "#E2EFC6", // 浅黄绿
  "#B6DFA4", // 柔和绿
  "#EAE7C4", // 浅米黄
  "#C9E6CD", // 薄荷绿
  "#D7E4B2", // 灰黄绿
  "#BCDCC9", // 灰青绿
  "#E8F0D8", // 淡奶绿
];

/** 暗色主题的原有分区色，本次只改亮色，这 6 个值不应再变。 */
const DARK_PALETTE = ["#324B52", "#484946", "#314C49", "#463E4D", "#304058", "#3D4D45"];

const world = JSON.parse(
  readFileSync("public/boundaries/world.geojson", "utf8"),
) as Boundaries;
const china = JSON.parse(
  readFileSync("public/boundaries/china.geojson", "utf8"),
) as Boundaries;

const toHex = ([r, g, b]: number[]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const positionsOf = (geometry: Boundaries["features"][number]["geometry"]) => {
  const positions: number[][] = [];
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") positions.push(node as number[]);
    else for (const child of node) walk(child);
  };
  walk(geometry.coordinates);
  return positions;
};

/** 独立于实现的重叠判定：共享同一个顶点坐标的区域一定相邻。 */
const overlappingPairs = (boundaries: Boundaries) => {
  const byVertex = new Map<string, Set<string>>();
  for (const feature of boundaries.features) {
    const regionId = String(feature.properties.regionId);
    for (const [longitude, latitude] of positionsOf(feature.geometry)) {
      const key = `${longitude.toFixed(5)},${latitude.toFixed(5)}`;
      const nodes = byVertex.get(key) ?? new Set<string>();
      nodes.add(regionId);
      byVertex.set(key, nodes);
    }
  }
  const pairs: [string, string][] = [];
  for (const nodes of byVertex.values()) {
    const list = [...nodes];
    for (let i = 0; i < list.length; i += 1)
      for (let j = i + 1; j < list.length; j += 1) pairs.push([list[i], list[j]]);
  }
  return pairs;
};

const datasets: [string, Boundaries][] = [
  ["world", world],
  ["china", china],
];

const landLayer = (theme: ColorTheme, boundaries: Boundaries) =>
  createMapLayers({
    world: boundaries, level: "world", regionId: "", mode: "fact", colorTheme: theme,
    select() {}, selectProvince() {},
  })[0];

const fillOf = (boundaries: Boundaries) =>
  landLayer("light", boundaries).props.getFillColor as (feature: unknown) => number[];

describe("区域色板与分配", () => {
  it("亮色主题使用规格给定的色板与底色", () => {
    expect([...eco.landPalette]).toEqual(SPEC_PALETTE);
    expect(eco.land).toBe("#CFE9BD");
    expect(eco.ocean).toBe("#5FBDF2");
    expect(eco.landHover).toBe("#B6DFA4");
  });

  it.each(datasets)("%s 的每个区域都取自色板且填色不透明", (_name, boundaries) => {
    const fill = fillOf(boundaries);
    const colors = boundaries.features.map((feature) => fill(feature));
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) {
      expect(SPEC_PALETTE).toContain(toHex(color.slice(0, 3)));
      expect(color[3]).toBe(255);
    }
  });

  it.each(datasets)("%s 共享边界的相邻区域取到不同颜色", (_name, boundaries) => {
    const indices = regionColorIndices(boundaries, SPEC_PALETTE.length);
    const pairs = overlappingPairs(boundaries);
    expect(pairs.length).toBeGreaterThan(0);
    const conflicts = pairs.filter(([a, b]) => indices.get(a) === indices.get(b));
    expect(conflicts).toEqual([]);
  });

  it("分配结果稳定，且整块色板都被用上", () => {
    for (const boundaries of [world, china]) {
      const indices = regionColorIndices(boundaries, SPEC_PALETTE.length);
      expect(regionColorIndices(boundaries, SPEC_PALETTE.length)).toEqual(indices);
      expect(new Set(indices.values()).size).toBe(SPEC_PALETTE.length);
    }
  });

  it("行政边界为 rgba(224,128,118,0.55)，悬停填色为 #B6DFA4", () => {
    const layer = landLayer("light", world);
    expect(layer.props.getLineColor).toEqual([224, 128, 118, 140]);
    expect(layer.props.highlightColor).toEqual([182, 223, 164, 255]);
  });

  it.each(datasets)("%s 的暗色配色与分配保持原样", (_name, boundaries) => {
    const fill = landLayer("dark", boundaries).props.getFillColor as
      (feature: unknown) => number[];
    for (const feature of boundaries.features) {
      const regionId = String(feature.properties.regionId);
      // 仍然是原来的哈希分配，没有被亮色的邻接着色替换。
      expect(fill(feature)).toEqual([...getLandColor(regionId, "dark"), 255]);
      expect(DARK_PALETTE).toContain(toHex(fill(feature).slice(0, 3)));
    }
  });
});
