import { relationColor, relationDomainInfo } from "../src/utils/relationFilters";
import { describe, expect, it } from "vitest";
import { createMapLayers, createInfluenceLayers } from "../src/utils/mapLayers";
import { createRelationLayers, prepareRelationPaths } from "../src/utils/relationLayers";
import type { Entity, Relation } from "../src/types";
import { ECOLOGY_THEME as eco, rgb } from "../src/utils/ecologyTheme";

const entities: Entity[] = [
  { id: "farm", name: "基地", type: "production_base", position: [112, 28], factIds: [] },
  { id: "port", name: "港口", type: "opaque-port-category", displayGroup: "port_airport", position: [120, 30], factIds: [] },
  { id: "risk", name: "风险", type: "opaque-risk-category", displayGroup: "geo_risk", position: [130, 35], factIds: [] },
];
const relations: Relation[] = [
  { id: "a", sourceId: "farm", targetId: "port", type: "01a12521-7294-71a5-99f1-0ed778a2428f", colorDomain: "production_supply", factIds: [] },
  { id: "b", sourceId: "port", targetId: "risk", type: "01a12521-7294-71a5-99f1-0ed778a2428f", colorDomain: "logistics", factIds: [] },
];
const options = {
  entities, relations, level: "world", crossRegion: true, flatWorld: false,
  isGlobe: false, longitude: 105, latitude: 35, highlightedEntityId: null,
  paths: prepareRelationPaths(entities, relations, false, false), select() {},
};

describe("生态亮色主题集成", () => {
  it("复用路径与图层 ID，重点关系保留筛选图例颜色，暗色可恢复", () => {
    const dark = createRelationLayers({ ...options, colorTheme: "dark" });
    const light = createRelationLayers({ ...options, colorTheme: "light", focusEntityIds: ["farm"] });
    expect(light.map((layer) => layer.id)).toEqual(dark.map((layer) => layer.id));
    const lines = light.find((layer) => layer.id === "real-relations")!;
    const edges = lines.props.data as { id: string; path: number[][]; color: number[] }[];
    expect(edges[0].color.slice(0, 3)).toEqual(relationDomainInfo.production_supply.color);
    expect(edges[1].color.slice(0, 3)).toEqual(relationDomainInfo.logistics.color);
    expect(edges[0].path).toBe(options.paths.get("a"));
    expect(edges[1].color[3]).toBeLessThan(edges[0].color[3]);
    expect(createRelationLayers({ ...options, colorTheme: "dark" })[0].props.data).toEqual(dark[0].props.data);
  });
  it.each(Object.keys(relationDomainInfo))("%s 分类在选中和临时高亮时仍与图例同色", (domain) => {
    const layers = createRelationLayers({
      ...options, colorTheme: "light", highlightedEntityId: "farm",
      glowingRelationIds: ["a"], relations: [{ ...relations[0], colorDomain: domain }],
    });
    const edges = layers[0].props.data as { color: number[] }[];
    expect(edges[0].color.slice(0, 3)).toEqual(relationColor("", undefined, domain));
    const arrows = layers.find((layer) => layer.id === "relation-arrows")!.props.data as { color: number[] }[];
    expect(arrows[0].color).toEqual(edges[0].color);
  });
  it("相同节点数据切主题时刷新 GPU 属性，仅选中节点有额外描边", () => {
    const dark = createRelationLayers({ ...options, colorTheme: "dark" });
    const light = createRelationLayers({ ...options, colorTheme: "light", highlightedEntityId: "farm" });
    const node = light.find((layer) => layer.id === "real-entities")!;
    const old = dark.find((layer) => layer.id === "real-entities")!;
    expect(node.props.updateTriggers!.getFillColor).not.toEqual(old.props.updateTriggers!.getFillColor);
    expect(node.props.updateTriggers!.getRadius).not.toEqual(old.props.updateTriggers!.getRadius);
    const fill = node.props.getFillColor as (entity: Entity) => number[];
    const width = node.props.getLineWidth as (entity: Entity) => number;
    expect(fill(entities[0]).slice(0, 3)).toEqual(rgb(eco.production));
    expect(fill(entities[1]).slice(0, 3)).toEqual(rgb(eco.hub));
    expect(fill(entities[2]).slice(0, 3)).toEqual(rgb(eco.anomaly));
    expect(width(entities[0])).toBe(5);
    expect(width(entities[1])).toBe(2);
    expect(width(entities[2])).toBe(0);
  });
  it("亮暗切换保留拾取回调和底图 ID，选中区域透明且触发器含主题", () => {
    const selections: string[] = [];
    const common = { mode: "fact" as const, level: "country", regionId: "CN", select() {}, selectCountry(id: string) { selections.push(id); }, selectProvince() {} };
    const light = createMapLayers({ ...common, colorTheme: "light" });
    const dark = createMapLayers({ ...common, colorTheme: "dark" });
    expect(light.map((layer) => layer.id)).toEqual(dark.map((layer) => layer.id));
    const world = light[0];
    const fill = world.props.getFillColor as (feature: unknown) => number[];
    expect(fill({ properties: { regionId: "CN" } })).toEqual([...rgb(eco.selected), 170]);
    world.props.onClick!({ object: { properties: { regionId: "CN" } } } as never, {} as never);
    expect(selections).toEqual(["CN"]);
    expect(world.props.updateTriggers!.getFillColor).toContain("light");
    expect(world.props.getLineColor).toEqual(rgb(eco.borderCountry));
  });
  it("影响圈动画在两个主题中保留 ID、数据和不可拾取状态", () => {
    const light = createInfluenceLayers([], 0.2, false, "light");
    const dark = createInfluenceLayers([], 0.2, false, "dark");
    expect(light.map((layer) => layer.id)).toEqual(dark.map((layer) => layer.id));
    expect(light[0].props.getColor).toEqual([...rgb(eco.priorityRoute), 152]);
    expect(light.every((layer) => !layer.props.pickable)).toBe(true);
    expect(light[0].props.updateTriggers!.getColor).toEqual([0.2, "light"]);
  });
});
