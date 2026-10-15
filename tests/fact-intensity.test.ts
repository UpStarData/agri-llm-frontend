import { describe, expect, it } from "vitest";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { FactPoint } from "../src/api/fact";
import { createMapLayers } from "../src/utils/mapLayers";
import { ECOLOGY_THEME as eco, factIntensityColor, rgb } from "../src/utils/ecologyTheme";

const point = (factId: string, intensity?: number): FactPoint =>
  ({ factId, geoPoint: [112, 28], ...(intensity === undefined ? {} : { intensity }) });

const factFill = (colorTheme: "light" | "dark") => {
  const layer = createMapLayers({
    mode: "fact", colorTheme, level: "world",
    select: () => {}, selectProvince: () => {},
  }).find((item) => item.id === "real-facts") as ScatterplotLayer<FactPoint>;
  return layer.props.getFillColor as (point: FactPoint) => number[];
};

describe("事实星点热度着色", () => {
  it.each(["light", "dark"] as const)("%s 主题星点缺省时保留主题色，intensity 越低越灰", (colorTheme) => {
    const fill = factFill(colorTheme);
    expect(rgb(eco.factPoint)).toEqual([255, 255, 255]);
    expect(fill(point("a"))).toEqual(rgb(eco.factPoint));
    expect(fill(point("b", 100))).toEqual(rgb(eco.factPoint));
    expect(fill(point("c", 0))).toEqual(rgb(eco.factPointLow));
  });
  it("热度越高越接近主题色，59 与主题色有肉眼可见的差别", () => {
    const low = factIntensityColor(20);
    const mid = factIntensityColor(59);
    const high = factIntensityColor(90);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(mid[channel]).toBeGreaterThan(low[channel]);
      expect(high[channel]).toBeGreaterThan(mid[channel]);
    }
    expect(mid).not.toEqual(rgb(eco.factPoint));
    expect(Math.max(...rgb(eco.factPoint).map((value, index) => value - mid[index])))
      .toBeGreaterThan(20);
  });
  it("越界与非法热度按边界处理，缺省或非数字时保留主题色", () => {
    expect(factIntensityColor(-10)).toEqual(rgb(eco.factPointLow));
    expect(factIntensityColor(180)).toEqual(rgb(eco.factPoint));
    expect(factIntensityColor(Number.NaN)).toEqual(rgb(eco.factPoint));
    expect(factIntensityColor(undefined)).toEqual(rgb(eco.factPoint));
  });
  it("叠加点位与来源点不受热度色标影响，保持彩色", () => {
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world",
      select: () => {}, selectProvince: () => {},
    });
    for (const id of ["overlay-ports", "overlay-fact-sources"]) {
      const fill = layers.find((item) => item.id === id)!.props.getFillColor as number[];
      expect(new Set(fill.slice(0, 3)).size).toBeGreaterThan(1);
    }
  });
});
