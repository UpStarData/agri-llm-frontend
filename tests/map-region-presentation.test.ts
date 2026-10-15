import { readFileSync } from "node:fs";
import { WebMercatorViewport } from "@deck.gl/core";
import { describe, expect, it } from "vitest";
import { getMapPointScale, getRegionView } from "../src/utils/map";
import { createInfluenceLayers } from "../src/utils/mapLayers";
import type { Boundaries } from "../src/types";

describe("区域取景与点位尺寸", () => {
  it.each([[1440, 900], [1920, 680], [490, 850]])("%s × %s 中国取景包含南海全部边界", (width, height) => {
    const china = JSON.parse(readFileSync("public/boundaries/china.geojson", "utf8")) as Boundaries;
    const viewport = new WebMercatorViewport({ width, height, ...getRegionView("country", "CN", china, width, height) });
    for (const feature of china.features) {
      const positions = feature.geometry.type === "Polygon" ? feature.geometry.coordinates.flat() : feature.geometry.coordinates.flat(2);
      for (const position of positions) {
        const [x, y] = viewport.project(position);
        expect(x).toBeGreaterThanOrEqual(69);
        expect(x).toBeLessThanOrEqual(width - 69);
        expect(y).toBeGreaterThanOrEqual(69);
        expect(y).toBeLessThanOrEqual(height - 69);
      }
    }
  });
  it("全球、中国、省级点位逐级放大，球体使用全球尺寸", () => {
    expect(getMapPointScale("world")).toBeLessThan(getMapPointScale("country"));
    expect(getMapPointScale("country")).toBeLessThan(getMapPointScale("province"));
    expect(getMapPointScale("province", true)).toBe(getMapPointScale("world"));
  });
  it("波纹出生和消失时透明，中途可见；同时只保留两个波前加一个范围圈", () => {
    const layers = (phase: number) => createInfluenceLayers([], phase, false);
    const alpha = (phase: number) => (layers(phase)[0].props.getColor as number[])[3];
    expect(alpha(0)).toBe(0);
    expect(alpha(0.5)).toBeGreaterThan(200);
    expect(alpha(0.9999)).toBe(0);
    expect(layers(0.5).map((layer) => layer.id)).toEqual([
      "overlay-influence-ripple-0",
      "overlay-influence-ripple-1",
      "overlay-influence-boundary",
    ]);
    // 范围边界圈不参与扩散：几何更新键不随相位变化，deck.gl 每个周期只重切一次。
    const trigger = (phase: number, index: number) =>
      layers(phase)[index].props.updateTriggers!.getPath;
    expect(trigger(0.1, 2)).toEqual(trigger(0.7, 2));
    expect(trigger(0.1, 0)).not.toEqual(trigger(0.7, 0));
  });
});
