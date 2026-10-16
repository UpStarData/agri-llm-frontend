import { describe, expect, it } from "vitest";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { FactPoint } from "../src/api/fact";
import { applyFactIntensity, createMapLayers } from "../src/utils/mapLayers";
import { factIntensityAt } from "../src/utils/factIntensity";
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
  it("时间序列倒序播放，整轮 3.2 秒先快后慢，不修改接口数组", () => {
    const item = { ...point("a", 80), intensityArr: [98, 54, 24, 6, 0] };
    const original = [...item.intensityArr];
    const expected = [0, 6, 24, 54, 98];
    expected.forEach((value, index) => {
      const seconds = 3.2 * (1 - Math.pow(1 - index / 4, 1 / 2.2));
      expect(factIntensityAt(item, seconds)).toBeCloseTo(value);
    });
    expect(factIntensityAt(item, 30)).toBe(98);
    expect(factIntensityAt(item, 0)).toBe(0);
    expect(item.intensityArr).toEqual(original);
    // 按序列推进的速度先快后慢；使用均匀数值避免热度间距干扰。
    const uniform = { ...item, intensityArr: [100, 75, 50, 25, 0] };
    expect(factIntensityAt(uniform, 1.6)).toBeGreaterThan(50);
    expect(factIntensityAt({ ...item, intensityArr: [100, 80, 60, 40, 20, 10, 0] }, 3.2)).toBe(100);
    expect(factIntensityAt({ ...item, intensityArr: [54] }, 20)).toBe(54);
    expect(factIntensityAt({ ...item, intensityArr: [] }, 20)).toBe(80);
    expect(factIntensityAt(point("a"), 20)).toBeUndefined();
  });
  it("动画保留点位、其他图层与实时高亮，普通渲染仍使用 intensity", () => {
    const item = { ...point("a", 80), intensityArr: [98, 54, 24, 6, 0] };
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points: [item], glowingFactIds: ["live"],
      select: () => {}, selectProvince: () => {},
    });
    const original = layers.find((layer) => layer.id === "real-facts") as ScatterplotLayer<FactPoint>;
    expect((original.props.getFillColor as (p: FactPoint) => number[])(item)).toEqual(factIntensityColor(80));
    const updated = applyFactIntensity(layers, 3.2);
    const facts = updated.find((layer) => layer.id === "real-facts") as ScatterplotLayer<FactPoint>;
    const fill = facts.props.getFillColor as (p: FactPoint) => number[];
    expect(fill(item)).toEqual(factIntensityColor(98));
    expect(fill({ ...item, factId: "live" })).toEqual([255, 225, 100, 255]);
    expect(facts.props.data).toBe(original.props.data);
    expect(facts.props.getPosition).toBe(original.props.getPosition);
    expect(facts.props.transitions?.getFillColor).toBe(1);
    updated.forEach((layer, index) => {
      if (layer.id !== "real-facts" && layer.id !== "live-fact-glow") expect(layer).toBe(layers[index]);
    });
  });
  it("仅时间动画隐藏热度为 0 的点及光晕，去掉描边，热度上升后恢复，缺省热度仍展示", () => {
    const item = { ...point("a", 0), intensityArr: [98, 0, 0, 0, 0] };
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points: [item], glowingFactIds: ["a"],
      select: () => {}, selectProvince: () => {},
    });
    for (const seconds of [0, 0.1, 3.2]) {
      const updated = applyFactIntensity(layers, seconds);
      for (const id of ["real-facts", "live-fact-glow"]) {
        const layer = updated.find((entry) => entry.id === id) as ScatterplotLayer<FactPoint>;
        const radius = layer.props.getRadius as (p: FactPoint) => number;
        const width = layer.props.getLineWidth as (p: FactPoint) => number;
        expect(radius(item) > 0).toBe(seconds === 3.2);
        expect(width(item) > 0).toBe(seconds === 3.2);
        expect(radius({ ...item, intensityArr: [0, 0] })).toBe(0);
        expect(radius(point("a"))).toBeGreaterThan(0);
        expect(layer.props.data).toBe(layers.find((entry) => entry.id === id)!.props.data);
      }
    }
    const original = layers.find((entry) => entry.id === "real-facts") as ScatterplotLayer<FactPoint>;
    expect(original.props.getRadius).toBeGreaterThan(0);
    expect(original.props.getLineWidth).toBe(1);
  });
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
