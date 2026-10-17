import { describe, expect, it, vi } from "vitest";
import type { EntityCategoryCatalog, RelationTypeCatalog } from "../src/api/relation";
import type { Entity, Relation } from "../src/types";
import { ECOLOGY_THEME as theme, entityCategoryColors, factCategoryColors, rgb } from "../src/utils/ecologyTheme";
import { relationColor, relationDomainInfo } from "../src/utils/relationFilters";
import { createRelationFlowLayer, createRelationLayers, prepareRelationPaths, revealRelationLayers } from "../src/utils/relationLayers";

const roots = [
  ["01a11fc7-fcee-7033-8584-5e7ed760b5a7", theme.categoryLogistics],
  ["01a11fc7-fcee-7033-8584-5e8567be2315", theme.categoryPolicy],
  ["01a11fc7-fcee-7033-8584-5e89a7a82eac", theme.categoryNature],
  ["01a11fc7-fcee-7033-8584-5e90db4461bf", theme.categoryEvent],
];
const catalog: EntityCategoryCatalog = {
  version: "test",
  categories: roots.map(([id], index) => ({
    id, name: "改名不影响归属", children: [
      { id: `child-${index}`, name: "任意名称", displayGroup: "event" },
      { id: `sibling-${index}`, name: "任意名称", displayGroup: "market" },
    ],
  })),
};
const entities: Entity[] = [
  { id: "a", name: "自然与生态", type: "child-0", position: [112, 28], factIds: [] },
  { id: "b", name: "市场", type: "child-2", position: [120, 30], factIds: [] },
  { id: "unknown", name: "农作物", type: "unknown", position: [125, 30], factIds: [] },
];
const relations: Relation[] = Object.keys(relationDomainInfo).map((colorDomain) => ({
  id: colorDomain, sourceId: "a", targetId: "b", type: colorDomain, colorDomain, factIds: [],
}));

describe("关联层分类主题色", () => {
  it("通过目录 ID 继承一级颜色，顺序、名称、displayGroup 不决定颜色", () => {
    const colors = entityCategoryColors({ ...catalog, categories: [...catalog.categories].reverse() });
    roots.forEach(([id, color], index) => {
      for (const key of [id, `child-${index}`, `sibling-${index}`]) expect(colors.get(key)).toEqual(rgb(color));
    });
    expect(entityCategoryColors().size).toBe(0);
    expect(entityCategoryColors({ version: "test", categories: [
      { id: "unknown", name: "农作物", children: [{ id: "unmapped", name: "自然与生态", displayGroup: "variety" }] },
    ] }).get("unmapped")).toEqual(rgb(theme.factPoint));
  });

  it("事实与关系引用同一主题色板，未知关系统一中性色", () => {
    expect(relationDomainInfo.production_supply.color).toEqual(rgb(theme.categoryProduction));
    expect(relationDomainInfo.business_org.color).toEqual(rgb(theme.categoryMarket));
    expect(relationDomainInfo.spatial.color).toEqual(rgb(theme.categoryNature));
    expect(relationDomainInfo.logistics.color).toEqual(rgb(theme.categoryLogistics));
    expect(relationDomainInfo.policy.color).toEqual(rgb(theme.categoryPolicy));
    expect(relationDomainInfo.impact.color).toEqual(rgb(theme.categoryEvent));
    expect(factCategoryColors([{ id: "root", name: "生产与供给", categories: [] }]).get("root"))
      .toEqual(relationDomainInfo.production_supply.color);
    expect(relationColor("unknown", undefined, "unknown")).toEqual(rgb(theme.factPoint));
    const types: RelationTypeCatalog = { version: "test", types: [{
      id: "opaque", name: "任意名称", colorDomain: "policy", directed: true, sourceCategoryIds: [], targetCategoryIds: [],
    }] };
    expect(relationColor("opaque", types)).toEqual(rgb(theme.categoryPolicy));
  });

  it.each(["dark", "light"] as const)("%s 中点、选中线、流光保留各自分类色和点击", (colorTheme) => {
    const select = vi.fn();
    const colors = entityCategoryColors(catalog);
    const layers = createRelationLayers({
      entities, relations, categoryColors: colors, colorTheme,
      paths: prepareRelationPaths(entities, relations, false, false),
      flatWorld: false, isGlobe: false, longitude: 0, latitude: 0,
      highlightedEntityId: "a", focusEntityIds: ["a"], glowingRelationIds: relations.map((r) => r.id), select,
    });
    const nodes = layers[1];
    expect(nodes.props.data).toHaveLength(entities.length);
    const fill = nodes.props.getFillColor as (entity: Entity) => number[];
    expect(fill(entities[0])).toEqual([...rgb(theme.categoryLogistics), 255]);
    expect(fill(entities[1])).toEqual([...rgb(theme.categoryNature), 255]);
    expect(fill(entities[2])).toEqual([...rgb(theme.factPoint), 255]);
    expect(nodes.props.updateTriggers!.getFillColor).toBe(colors);
    const edges = layers[0].props.data as { id: string; color: number[] }[];
    expect(edges).toHaveLength(relations.length);
    edges.forEach((edge) => expect(edge.color.slice(0, 3)).toEqual(relationColor("", undefined, edge.id)));
    const flow = createRelationFlowLayer(revealRelationLayers(layers, Infinity), 0.5);
    const particles = flow.props.data as { relationId: string; colors: number[][] }[];
    particles.forEach((particle) => particle.colors.forEach((color) => {
      expect(color.slice(0, 3)).toEqual(relationColor("", undefined, particle.relationId));
    }));
    expect(flow.props.pickable).toBe(false);
    nodes.props.onClick!({ object: entities[0] } as never, {} as never);
    layers[0].props.onClick!({ object: edges[0] } as never, {} as never);
    expect(select.mock.calls).toEqual([[{ kind: "entity", id: "a" }], [{ kind: "relation", id: edges[0].id }]]);
  });
});
