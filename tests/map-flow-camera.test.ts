import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapViewState } from "@deck.gl/core";
import type { Entity, Relation } from "../src/types";

// 保留依赖比较，模拟连续相机更新；验证相机变化不会重建球面流光图层。
const hooks = vi.hoisted(() => ({
  cursor: 0,
  memo: [] as { deps: unknown[]; value: unknown }[],
  state: {
    mode: "relation", level: "world", regionId: undefined, colorTheme: "light",
    mapOverlayVisibility: { ports: false, factSources: false, influence: false },
    highlightedEntityId: null, relationGlow: { entityIds: [], relationIds: [], until: 0 },
    select: () => {}, selection: null,
  },
}));
vi.mock("react", () => ({
  useState: () => [10, () => {}],
  useEffect: () => {},
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.memo[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])))
      hooks.memo[index] = { deps, value: factory() };
    return hooks.memo[index].value;
  },
}));
vi.mock("../src/store", () => ({ useDashboardStore: (selector) => selector(hooks.state) }));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector) => selector }));
import { useMapLayers as renderLayers } from "../src/hooks/useMapLayers";

const entities: Entity[] = [
  { id: "a", name: "A", type: "base", position: [112, 28], factIds: [] },
  { id: "b", name: "B", type: "port", position: [-70, -30], factIds: [] },
];
const relations: Relation[] = [{ id: "a-b", sourceId: "a", targetId: "b", type: "supplies", factIds: [] }];
const options = {
  data: { entities, relations }, width: 1200, height: 800,
  isGlobe: true, flatWorld: false, paused: false,
  setIsGlobe: () => {}, changeRegion: () => {},
};
const render = (camera: MapViewState) => {
  hooks.cursor = 0;
  return renderLayers({ ...options, camera });
};
describe("球体相机与流光独立更新", () => {
  beforeEach(() => { hooks.memo = []; });
  it("转动、缩放与俯仰只改变视角，关系线和流光图层实例保持不变", () => {
    const first = render({ longitude: 112, latitude: 28, zoom: 1 });
    for (const camera of [
      { longitude: -70, latitude: -30, zoom: 1 },
      { longitude: 180, latitude: 60, zoom: 2, bearing: 20 },
      { longitude: 112, latitude: 28, zoom: 1 },
    ]) {
      const moved = render(camera);
      for (const id of ["real-relations", "real-entities", "relation-flow"])
        expect(moved.find((layer) => layer?.id === id)).toBe(first.find((layer) => layer?.id === id));
    }
  });
});
