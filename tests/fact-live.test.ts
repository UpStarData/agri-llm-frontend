import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeFactPoints } from "../src/api/factLive";
import { createMapLayers, applyFactPointLayout } from "../src/utils/mapLayers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { FactPoint } from "../src/api/fact";

class FakeStream {
  onmessage: ((event: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { streams.push(this); }
}
let streams: FakeStream[] = [];
beforeEach(() => { streams = []; vi.stubGlobal("EventSource", FakeStream); });
afterEach(() => vi.unstubAllGlobals());
const point: FactPoint = { factId: "new", geoPoint: [112, 28], intensity: 10 };

describe("事实实时推送", () => {
  it.each(["china", "global", "hunan"] as const)("订阅 %s，去重并忽略无效载荷", (view) => {
    const receive = vi.fn();
    subscribeFactPoints(view, receive);
    expect(streams[0].url).toMatch(new RegExp(`/facts/points/live\\?view=${view}$`));
    ["", "connected", "{broken", "null", JSON.stringify({ ...point, geoPoint: [181, 20] }),
      JSON.stringify({ ...point, geoPoint: [112, "28"] }), JSON.stringify(point), JSON.stringify(point)]
      .forEach((data) => streams[0].onmessage?.({ data }));
    expect(receive).toHaveBeenCalledExactlyOnceWith(point);
  });
  it("清理连接后丢弃迟到事件", () => {
    const receive = vi.fn();
    const close = subscribeFactPoints("china", receive);
    const late = streams[0].onmessage;
    close();
    late?.({ data: JSON.stringify(point) });
    expect(receive).not.toHaveBeenCalled();
    expect(streams[0].close).toHaveBeenCalledOnce();
    expect(streams[0].onmessage).toBeNull();
  });
  it("仅新事实亮起，光晕跟随重叠点展开坐标；清除后恢复原色", () => {
    const create = (ids: string[]) => createMapLayers({ points: [point], glowingFactIds: ids,
      level: "world", mode: "fact", colorTheme: "dark", select: () => {}, selectProvince: () => {} });
    const layers = applyFactPointLayout(create(["new"]), new Map([[point, [113, 29]]]), 1, false);
    const glow = layers.find((layer) => layer.id === "live-fact-glow") as ScatterplotLayer<FactPoint>;
    expect((glow.props.getPosition as Function)(point)).toEqual([113, 29]);
    expect((glow.props.getRadius as Function)(point)).toBe(16);
    const regular = create([]).find((layer) => layer.id === "live-fact-glow") as ScatterplotLayer<FactPoint>;
    expect((regular.props.getRadius as Function)(point)).toBe(0);
  });
});
