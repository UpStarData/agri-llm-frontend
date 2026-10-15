import { describe, expect, it } from "vitest";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { FactPoint } from "../src/api/fact";
import { createMapLayers } from "../src/utils/mapLayers";

describe("事实地图点颜色", () => {
  it.each(["light", "dark"] as const)("%s 主题事实点统一使用白色，其他点保持彩色", (colorTheme) => {
    const layers = createMapLayers({
      mode: "fact", colorTheme, level: "world",
      select: () => {}, selectProvince: () => {},
    });
    const layer = layers.find((item) => item.id === "real-facts") as ScatterplotLayer<FactPoint>;
    expect(layer.props.getFillColor).toEqual([255, 255, 255]);
    for (const id of ["overlay-ports", "overlay-fact-sources"]) {
      const fill = layers.find((item) => item.id === id)!.props.getFillColor as number[];
      expect(new Set(fill.slice(0, 3)).size).toBeGreaterThan(1);
    }
  });
});
