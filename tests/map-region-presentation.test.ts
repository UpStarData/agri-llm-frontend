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
  it("波纹出生和消失时透明，中途可见且带柔光", () => {
    const alpha = (phase: number) => (createInfluenceLayers([], phase, false).find((layer) => layer.id === "overlay-influence-ring-0")!.props.getColor as number[])[3];
    expect(alpha(0)).toBe(0);
    expect(alpha(0.5)).toBeGreaterThan(200);
    expect(alpha(0.9999)).toBe(0);
    expect(createInfluenceLayers([], 0.5, false).filter((layer) => layer.id.includes("glow"))).toHaveLength(3);
  });
});
