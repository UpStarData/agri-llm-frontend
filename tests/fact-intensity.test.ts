import { describe, expect, it } from "vitest";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { FactPoint } from "../src/api/fact";
import { applyFactIntensity, createMapLayers } from "../src/utils/mapLayers";
import { factIntensityAt, factRevealAlpha, factRevealDelays } from "../src/utils/factIntensity";
import { ECOLOGY_THEME as eco, FACT_CATEGORY_COLORS, factCategoryColors, factIntensityColor, rgb } from "../src/utils/ecologyTheme";

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
    const item = { ...point("a", 98), intensityArr: [98, 54, 24, 6, 0] };
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
    const uniform = { ...item, intensity: 100, intensityArr: [100, 75, 50, 25, 0] };
    expect(factIntensityAt(uniform, 1.6)).toBeGreaterThan(50);
    expect(factIntensityAt({ ...item, intensity: 100, intensityArr: [100, 80, 60, 40, 20, 10, 0] }, 3.2)).toBe(100);
    expect(factIntensityAt({ ...item, intensity: 54, intensityArr: [54] }, 20)).toBe(54);
    expect(factIntensityAt({ ...item, intensityArr: [] }, 20)).toBe(98);
    expect(factIntensityAt(point("a"), 20)).toBeUndefined();
  });
  it("动画保留点位、其他图层与实时高亮，普通渲染仍使用 intensity", () => {
    const item = { ...point("a", 98), intensityArr: [98, 54, 24, 6, 0] };
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points: [item], glowingFactIds: ["live"],
      select: () => {}, selectProvince: () => {},
    });
    const original = layers.find((layer) => layer.id === "real-facts") as ScatterplotLayer<FactPoint>;
    expect((original.props.getFillColor as (p: FactPoint) => number[])(item)).toEqual(factIntensityColor(98));
    const updated = applyFactIntensity(layers, 3.2);
    const facts = updated.find((layer) => layer.id === "real-facts") as ScatterplotLayer<FactPoint>;
    const fill = facts.props.getFillColor as (p: FactPoint) => number[];
    expect(fill(item)).toEqual(factIntensityColor(98));
    expect(fill({ ...item, factId: "live" })).toEqual(factIntensityColor(98));
    expect(facts.props.data).toBe(original.props.data);
    expect(facts.props.getPosition).toBe(original.props.getPosition);
    expect(facts.props.transitions?.getFillColor).toBe(1);
    updated.forEach((layer, index) => {
      if (layer.id !== "real-facts" && layer.id !== "live-fact-glow") expect(layer).toBe(layers[index]);
    });
  });
  it("零热度和缺省热度同样淡入，不被共同的零值平台推迟出现", () => {
    const item = { ...point("a", 0), intensityArr: [98, 0, 0, 0, 0] };
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points: [item], glowingFactIds: ["a"],
      select: () => {}, selectProvince: () => {},
    });
    for (const seconds of [0, 0.1, 1.6, 3.2]) {
      const updated = applyFactIntensity(layers, seconds);
      for (const id of ["real-facts", "live-fact-glow"]) {
        const layer = updated.find((entry) => entry.id === id) as ScatterplotLayer<FactPoint>;
        const radius = layer.props.getRadius as (p: FactPoint) => number;
        expect(radius(item) > 0).toBe(seconds > 0);
        expect(layer.props.stroked).toBe(false);
        expect(radius({ ...item, intensityArr: [0, 0] }) > 0).toBe(seconds > 0);
        expect(radius(point("a")) > 0).toBe(seconds > 0);
        expect(layer.props.data).toBe(layers.find((entry) => entry.id === id)!.props.data);
      }
    }
    const original = layers.find((entry) => entry.id === "real-facts") as ScatterplotLayer<FactPoint>;
    expect(original.props.getRadius).toBeGreaterThan(0);
    expect(original.props.stroked).toBe(false);
  });
  it("新事实先逐批出现并淡入，最终全部展示，接口顺序和记录不变", () => {
    const points: FactPoint[] = Array.from({ length: 100 }, (_, index) => ({
      ...point(String(index), 75), occurredAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
    }));
    const original = JSON.stringify(points);
    const delays = factRevealDelays(points);
    expect(delays.get("99")).toBe(0);
    expect(delays.get("0")).toBeGreaterThan(delays.get("50")!);
    const count = (seconds: number) => points.filter((item) => factRevealAlpha(seconds, delays.get(item.factId)!) > 0).length;
    expect(count(0)).toBe(0);
    expect(count(0.5)).toBeGreaterThan(0);
    expect(count(0.5)).toBeLessThan(count(1.5));
    expect(count(1.5)).toBeGreaterThan(50);
    expect(count(3.2)).toBe(100);
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points, glowingFactIds: ["99"],
      select: () => {}, selectProvince: () => {},
    });
    const updated = applyFactIntensity(layers, 0.09, delays);
    for (const id of ["real-facts", "live-fact-glow"]) {
      const layer = updated.find((entry) => entry.id === id) as ScatterplotLayer<FactPoint>;
      const radius = layer.props.getRadius as (p: FactPoint) => number;
      const fill = layer.props.getFillColor as (p: FactPoint) => number[];
      expect(radius(points[0])).toBe(0);
      expect(fill(points[0])[3]).toBe(0);
      expect(layer.props.stroked).toBe(false);
      expect(fill(points[99])[3]).toBeGreaterThan(0);
      expect(fill(points[99])[3]).toBeLessThan(id === "real-facts" ? 255 : 70);
      expect(layer.props.data).toBe(points);
    }
    expect(JSON.stringify(points)).toBe(original);
    const finished = applyFactIntensity(layers, 3.2, delays)
      .find((entry) => entry.id === "real-facts") as ScatterplotLayer<FactPoint>;
    const fill = finished.props.getFillColor as (p: FactPoint) => number[];
    expect(points.every((item) => fill(item)[3] === 217)).toBe(true);
  });
  it("共同热度时钟不抵消错峰，长零值序列仍逐批可见并保持淡入连续", () => {
    const points = Array.from({ length: 100 }, (_, index) => ({
      ...point(String(index), 0), intensityArr: [0, 0, 0, 0, 0],
    }));
    const delays = factRevealDelays(points);
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points,
      select: () => {}, selectProvince: () => {},
    });
    const counts = [0, 0.5, 1.5, 3.2].map((seconds) => {
      const layer = applyFactIntensity(layers, seconds, delays)
        .find((entry) => entry.id === "real-facts") as ScatterplotLayer<FactPoint>;
      const fill = layer.props.getFillColor as (p: FactPoint) => number[];
      return points.filter((point) => fill(point)[3] > 0).length;
    });
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[1]).toBeLessThan(50);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[2]).toBeLessThan(100);
    expect(counts[3]).toBe(100);
    expect(factRevealAlpha(0.09, 0)).toBeCloseTo(0.75);
    expect(factRevealAlpha(0.18, 0)).toBe(1);
    expect(factRevealAlpha(3.2, 0)).toBe(1);
  });
  it("倒序播放的末段平滑收敛到 intensity，最终与普通点位透明度一致", () => {
    const item = { ...point("a", 80), intensityArr: [98, 54, 24, 6, 0] };
    expect(factIntensityAt(item, 0)).toBe(0);
    expect(factIntensityAt(item, 3.19)).toBeCloseTo(80, 2);
    expect(factIntensityAt(item, 3.2)).toBe(80);
    expect(factIntensityAt({ ...item, intensity: undefined }, 3.2)).toBe(98);
    expect(factIntensityAt({ ...item, intensity: 0 }, 3.2)).toBe(0);
    const layers = createMapLayers({
      mode: "fact", colorTheme: "light", level: "world", points: [item],
      select: () => {}, selectProvince: () => {},
    });
    const finished = applyFactIntensity(layers, 3.2)
      .find((entry) => entry.id === "real-facts") as ScatterplotLayer<FactPoint>;
    expect((finished.props.getFillColor as (p: FactPoint) => number[])(item))
      .toEqual(factIntensityColor(item.intensity));
    expect(item.intensityArr).toEqual([98, 54, 24, 6, 0]);
  });
  it.each(["light", "dark"] as const)("%s 主题未分类点使用中性色，热度只控制透明度", (colorTheme) => {
    const fill = factFill(colorTheme);
    expect(fill(point("a"))).toEqual([...rgb(eco.factPoint), 255]);
    expect(fill(point("b", 100))).toEqual([...rgb(eco.factPoint), 255]);
    expect(fill(point("c", 0))).toEqual([...rgb(eco.factPoint), 102]);
  });
  it("七大类查分类树取色，分类树顺序与 ID 不影响配色，静态和动画共用颜色", () => {
    const names = ["自然与生态", "生产与供给", "流通与供应链", "市场与交易", "消费与舆情", "政策与治理", "宏观与公共事件"];
    const expected = ["#4DDBA7", "#FFD166", "#69B8FF", "#FFA75C", "#F497C1", "#B49AF2", "#FF8B91"];
    const groups = names.map((name, i) => ({
      name, id: `group-${i}`, categories: [{ id: `category-${i}`, name: "二级", types: [{ id: `leaf-${i}`, name: "三级", emoji: "" }] }],
    })).reverse();
    const snapshot = JSON.stringify(groups);
    const colors = factCategoryColors(groups);
    const points = names.map((_, i) => ({ ...point(String(i), 50), categoryId: `leaf-${i}`, intensityArr: [50, 0] }));
    for (const theme of ["light", "dark"] as const) {
      const layers = createMapLayers({
        mode: "fact", colorTheme: theme, level: "world", points, categoryColors: colors, glowingFactIds: ["0"],
        select: () => {}, selectProvince: () => {},
      });
      for (const seconds of [undefined, 0.09, 0.5, 3.2]) {
        const layer = (seconds === undefined ? layers : applyFactIntensity(layers, seconds))
          .find((entry) => entry.id === "real-facts") as ScatterplotLayer<FactPoint>;
        const fill = layer.props.getFillColor as (p: FactPoint) => number[];
        points.forEach((point, i) => {
          expect(fill(point).slice(0, 3)).toEqual(rgb(expected[i]));
          if (seconds === undefined || seconds === 3.2) expect(fill(point)[3]).toBe(179);
          if (seconds === 0.09 && i === 0) {
            expect(fill(point)[3]).toBeGreaterThan(0);
            expect(fill(point)[3]).toBeLessThan(102);
          }
          expect(colors.get(`group-${i}`)).toEqual(rgb(expected[i]));
          expect(colors.get(`category-${i}`)).toEqual(rgb(expected[i]));
        });
        expect(layer.props.data).toBe(points);
        expect(layer.props.stroked).toBe(false);
      }
    }
    expect(JSON.stringify(groups)).toBe(snapshot);
    expect(FACT_CATEGORY_COLORS).toEqual(Object.fromEntries(names.map((name, i) => [name, expected[i]])));
  });
  it("热度只改变 alpha，越界按边界处理，缺省或非数字为完全不透明", () => {
    const base = rgb("#4DDBA7");
    const colors = [0, 20, 59, 90, 100].map((heat) => factIntensityColor(heat, base));
    colors.forEach((color) => expect(color.slice(0, 3)).toEqual(base));
    expect(colors.map((color) => color[3])).toEqual([102, 133, 192, 240, 255]);
    expect(factIntensityColor(-10, base)).toEqual([...base, 102]);
    for (const heat of [180, Number.NaN, undefined]) {
      expect(factIntensityColor(heat, base)).toEqual([...base, 255]);
    }
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
