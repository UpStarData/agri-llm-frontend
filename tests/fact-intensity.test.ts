import { describe, expect, it } from "vitest";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { FactPoint } from "../src/api/fact";
import { createMapLayers } from "../src/utils/mapLayers";

describe("事实地图热度", () => {
  it.each(["light", "dark"] as const)("%s 主题按热度从灰色连续过渡到主题色，其他点保持彩色", (colorTheme) => {
    const layers = createMapLayers({
      mode: "fact", colorTheme, level: "world",
      select: () => {}, selectProvince: () => {},
    });
    const layer = layers.find((item) => item.id === "real-facts") as ScatterplotLayer<FactPoint>;
    const accessor = layer.props.getFillColor;
    if (typeof accessor !== "function") throw new Error("事实点颜色应按热度计算");
    const color = (intensity?: number) => accessor({ factId: "fact", geoPoint: [112, 28], intensity }, {} as never) as number[];
    const cold = color(0), hot = color(100);
    expect(new Set(cold).size).toBe(1);
    expect(new Set(hot).size).toBeGreaterThan(1);
    for (const heat of [10, 50, 90]) {
      color(heat).forEach((channel, index) => {
        expect(Math.abs(channel - (cold[index] + (hot[index] - cold[index]) * heat / 100))).toBeLessThanOrEqual(0.5);
      });
    }
    expect(color(-10)).toEqual(cold);
    expect(color(110)).toEqual(hot);
    for (const invalid of [undefined, NaN, Infinity, null, "0"]) {
      expect(color(invalid as number | undefined)).toEqual(hot);
    }
    for (const id of ["overlay-ports", "overlay-fact-sources"]) {
      const fill = layers.find((item) => item.id === id)!.props.getFillColor as number[];
      expect(new Set(fill.slice(0, 3)).size).toBeGreaterThan(1);
    }
  });
});
