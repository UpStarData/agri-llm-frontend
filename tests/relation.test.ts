import { beforeEach, describe, expect, it } from "vitest";
import {
  filterRelationGraph,
  relationColor,
} from "../src/utils/relationFilters";
import {
  createRelationLayers as buildRelationLayers,
  prepareRelationPaths,
  createRelationFlowLayer,
  relationPath,
} from "../src/utils/relationLayers";
import { useDashboardStore } from "../src/store";
import type { Entity, Relation } from "../src/types";

function createRelationLayers(
  options: Omit<Parameters<typeof buildRelationLayers>[0], "paths"> & {
    phase: number;
  },
) {
  const layers = buildRelationLayers({
    ...options,
    paths: prepareRelationPaths(
      options.entities,
      options.relations,
      options.isGlobe,
      options.flatWorld,
    ),
  });
  return [...layers, createRelationFlowLayer(layers, options.phase)];
}

const nodes: Entity[] = [
  { id: "cherry", name: "车厘子", type: "水果", position: null, factIds: [] },
  {
    id: "cl",
    name: "智利产区",
    type: "产区与基地",
    position: [-70, -30],
    factIds: [],
    regionPath: [{ code: "CL", name: "智利", level: "country" }],
  },
  {
    id: "hx",
    name: "红星市场",
    type: "市场",
    position: [113, 28],
    factIds: [],
    regionPath: [
      { code: "CHN", name: "中国", level: "country" },
      { code: "CN-HN", name: "湖南", level: "province" },
    ],
  },
  {
    id: "hn",
    name: "湖南基地",
    type: "产区与基地",
    position: [112, 28],
    factIds: [],
    regionPath: [
      { code: "CHN", name: "中国", level: "country" },
      { code: "CN-HN", name: "湖南", level: "province" },
    ],
  },
];
const edges: Relation[] = [
  {
    id: "cl-hx",
    sourceId: "cl",
    targetId: "hx",
    type: "供应",
    scopeLayer: "global",
    factIds: ["f1"],
    involved_varieties: ["cherry"],
  },
  {
    id: "hn-hx",
    sourceId: "hn",
    targetId: "hx",
    type: "供应",
    scopeLayer: "hunan",
    factIds: ["f2", "f3"],
    involved_varieties: ["durian"],
  },
];
const options = {
  entities: nodes,
  relations: edges,
  level: "world",
  crossRegion: true,
  flatWorld: false,
  isGlobe: false,
  longitude: 105,
  latitude: 35,
  phase: 0.25,
  highlightedEntityId: null,
  select() {},
};
const edgeData = (layers: ReturnType<typeof createRelationLayers>) =>
  layers.find((l) => l.id === "real-relations")!.props.data as Relation[];

describe("关联筛选与地图规则", () => {
  it("目录 key 能筛选按中文名称返回的本体与关系", () => {
    const categories = {
      version: "EC-v1",
      categories: [
        {
          key: "geo",
          name: "地理与设施",
          children: [{ key: "market", name: "市场", displayGroup: "market" }],
        },
      ],
    };
    const types = {
      version: "RT-v1",
      types: [
        {
          key: "supplies",
          name: "供应",
          colorDomain: "production_supply",
          directed: true,
          sourceL2s: [],
          targetL2s: [],
        },
      ],
    };
    expect(relationColor("supplies", types)).toEqual([77, 150, 106]);
    expect(
      filterRelationGraph(
        nodes,
        edges,
        ["market"],
        [],
        [],
        "",
        categories,
        types,
      ).entities.some((entity) => entity.id === "hx"),
    ).toBe(false);
    expect(
      filterRelationGraph(
        nodes,
        edges,
        [],
        ["supplies"],
        [],
        "",
        categories,
        types,
      ).relations,
    ).toEqual([]);
  });
  it("关闭关系类型不移除本体", () => {
    const result = filterRelationGraph(nodes, edges, [], ["供应"], []);
    expect(result.entities).toEqual(nodes);
    expect(result.relations).toEqual([]);
  });
  it("品种从 involved_varieties 取关系端点，并保留无坐标品种自身", () => {
    const result = filterRelationGraph(nodes, edges, [], [], ["cherry"]);
    expect(result.entities.map((n) => n.id)).toEqual(["cherry", "cl", "hx"]);
    expect(result.relations.map((e) => e.id)).toEqual(["cl-hx"]);
    const filtered = filterRelationGraph(
      nodes,
      edges,
      ["市场"],
      [],
      ["cherry"],
    );
    expect(filtered.entities.some((e) => e.id === "hx")).toBe(false);
    expect(filtered.relations).toEqual([]);
  });
  it("湖南仅本地线，跨区域开启后允许智利到湖南，分类仍优先", () => {
    expect(
      edgeData(
        createRelationLayers({
          ...options,
          level: "province",
          regionId: "430000",
          crossRegion: false,
        }),
      ).map((e) => e.id),
    ).toEqual(["hn-hx"]);
    expect(
      edgeData(
        createRelationLayers({
          ...options,
          level: "province",
          regionId: "430000",
        }),
      ).map((e) => e.id),
    ).toEqual(["cl-hx", "hn-hx"]);
    const filtered = filterRelationGraph(nodes, edges, ["市场"], [], []);
    expect(
      edgeData(
        createRelationLayers({
          ...options,
          ...filtered,
          level: "province",
          regionId: "430000",
        }),
      ),
    ).toEqual([]);
  });
  it("重点越过地理层级；小于8px和无坐标关系不强行上图", () => {
    expect(
      edgeData(
        createRelationLayers({
          ...options,
          level: "province",
          regionId: "430000",
          crossRegion: false,
          focusEntityIds: ["cl"],
        }),
      ),
    ).toHaveLength(2);
    expect(
      edgeData(createRelationLayers({ ...options, project: () => [0, 0] })),
    ).toEqual([]);
    expect(
      edgeData(
        createRelationLayers({
          ...options,
          relations: [{ ...edges[0], sourceId: "cherry" }],
        }),
      ),
    ).toEqual([]);
  });
  it("合作双向流动且无箭头，业务曲线可拾取，装饰不可拾取", () => {
    const layers = createRelationLayers({
      ...options,
      relations: [{ ...edges[0], type: "合作" }],
    });
    expect(layers.find((l) => l.id === "relation-arrows")).toBeUndefined();
    expect(
      layers.find((l) => l.id === "relation-flow")!.props.data,
    ).toHaveLength(2);
    expect(layers.find((l) => l.id === "relation-flow")!.props.pickable).toBe(
      false,
    );
    expect(layers.find((l) => l.id === "real-relations")!.props.pickable).toBe(
      true,
    );
    expect(
      createRelationLayers(options).find((l) => l.id === "relation-arrows")!
        .props.data,
    ).toHaveLength(2);
  });
  it.each([false, true])("%s 模式点击关系线打开关系详情", (isGlobe) => {
    const selections: { kind: string; id: string }[] = [];
    const layers = createRelationLayers({
      ...options,
      isGlobe,
      relations: [edges[1]],
      select: (selection) => selections.push(selection),
    });
    const line = layers.find((layer) => layer.id === "real-relations")!;
    expect(line.props.pickable).toBe(true);
    expect(line.props.widthMinPixels).toBe(2);
    const edge = (line.props.data as Relation[])[0];
    expect(edge.id).toBe("hn-hx");
    line.props.onClick!({ object: edge } as never, {} as never);
    expect(selections).toEqual([{ kind: "relation", id: "hn-hx" }]);
  });
  it("大圆跨反经线连续、端点正确、重合与对跖点无NaN", () => {
    const path = relationPath([170, 10], [-170, 10], true);
    expect(path[0][0]).toBeCloseTo(170);
    expect(path.at(-1)![0]).toBeCloseTo(190);
    expect(
      path.every((p, i) => i === 0 || Math.abs(p[0] - path[i - 1][0]) < 180),
    ).toBe(true);
    for (const [a, b] of [
      [
        [0, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [180, 0],
      ],
    ] as const) {
      expect(
        relationPath([...a], [...b], true)
          .flat()
          .every(Number.isFinite),
      ).toBe(true);
    }
  });
  it("平面关系有弧度且两端仍落在节点上，地球关系向外拱起", () => {
    const flat = relationPath([112, 28], [114, 28], false);
    expect(flat[0]).toEqual([112, 28, 0]);
    expect(flat.at(-1)).toEqual([114, 28, 0]);
    expect(flat[16][1]).toBeGreaterThan(28);
    expect(flat[16][2]).toBe(0);
    const globe = relationPath([112, 28], [114, 28], true);
    expect(globe[0][2]).toBe(0);
    expect(globe.at(-1)![2]).toBeCloseTo(0);
    expect(globe[16][2]).toBeGreaterThan(0);
  });
});
describe("关联上下文与详情", () => {
  beforeEach(() =>
    useDashboardStore.setState(useDashboardStore.getInitialState(), true),
  );
  it("事实上下文进入不带入事实地域，返回恢复；同上下文不重建", () => {
    const store = useDashboardStore.getState();
    store.setFactRegion("CN", "430000");
    store.select({ kind: "fact", id: "f1" });
    store.enterRelation({ factId: "f1", factTitle: "事实1" });
    expect(useDashboardStore.getState()).toMatchObject({
      mode: "relation",
      level: "world",
      selection: null,
    });
    const revision = useDashboardStore.getState().relationRevision;
    store.setMode("fact");
    expect(useDashboardStore.getState()).toMatchObject({
      regionId: "430000",
      selection: { kind: "fact", id: "f1" },
      detailsOpen: true,
    });
    store.enterRelation({ factId: "f1", factTitle: "事实1" });
    expect(useDashboardStore.getState().relationRevision).toBe(revision);
    store.refreshRelationContext();
    expect(useDashboardStore.getState().relationRevision).toBe(revision + 1);
  });
  it("品种同步并重建，关系类型和视角不重建", () => {
    const store = useDashboardStore.getState();
    store.enterRelation({ factId: "f1" });
    const revision = useDashboardStore.getState().relationRevision;
    store.setRelationFilters({ excludedTypes: ["供应"] });
    store.setRegion("country", "CN");
    expect(useDashboardStore.getState().relationRevision).toBe(revision);
    store.setFactFilters({ varieties: ["e:cmd:durian", "e:cmd:cherry"] });
    expect(useDashboardStore.getState().relationRevision).toBe(revision + 1);
    store.setMode("fact");
    expect(useDashboardStore.getState().factFilters.varieties).toEqual([
      "e:cmd:durian",
      "e:cmd:cherry",
    ]);
  });
  it("支撑事实在当前tab中打开，逐层返回原本体与关系", () => {
    const store = useDashboardStore.getState();
    store.setMode("relation");
    store.select({ kind: "entity", id: "e1" });
    store.pushDetail({ kind: "relation", id: "r1" });
    store.pushDetail({ kind: "fact", id: "f1" });
    expect(useDashboardStore.getState().mode).toBe("relation");
    store.backDetail();
    expect(useDashboardStore.getState().selection).toEqual({
      kind: "relation",
      id: "r1",
    });
    store.backDetail();
    expect(useDashboardStore.getState().selection).toEqual({
      kind: "entity",
      id: "e1",
    });
  });
});

describe("地图路径缓存", () => {
  it("拖动复用路径坐标，动画只构造光点", () => {
    const paths = prepareRelationPaths(nodes, edges, false, false);
    const first = buildRelationLayers({ ...options, paths });
    const moved = buildRelationLayers({ ...options, paths, longitude: 110 });
    const firstEdge = first.find((layer) => layer.id === "real-relations")!;
    const movedEdge = moved.find((layer) => layer.id === "real-relations")!;
    expect(
      movedEdge.props.dataComparator!(
        movedEdge.props.data,
        firstEdge.props.data,
      ),
    ).toBe(true);
    expect((movedEdge.props.data as { path: number[][] }[])[0].path).toBe(
      paths.get("cl-hx"),
    );
    const before = createRelationFlowLayer(first, 0.1);
    const after = createRelationFlowLayer(first, 0.8);
    expect(before.props.data).not.toEqual(after.props.data);
    expect((firstEdge.props.data as { path: number[][] }[])[0].path).toBe(
      paths.get("cl-hx"),
    );
  });
  it("数据或高亮变更会使路径缓冲失效", () => {
    const paths = prepareRelationPaths(nodes, edges, false, false);
    const first = buildRelationLayers({ ...options, paths }).find(
      (layer) => layer.id === "real-relations",
    )!;
    const highlighted = buildRelationLayers({
      ...options,
      paths,
      highlightedEntityId: "cl",
    }).find((layer) => layer.id === "real-relations")!;
    expect(
      highlighted.props.dataComparator!(
        highlighted.props.data,
        first.props.data,
      ),
    ).toBe(false);
    const newPaths = prepareRelationPaths(nodes, edges, false, true);
    expect(newPaths.get("cl-hx")).not.toEqual(paths.get("cl-hx"));
  });
  it("两层日志默认收起，收起列表不关闭当前详情", () => {
    useDashboardStore.setState(useDashboardStore.getInitialState(), true);
    for (const mode of ["fact", "relation"] as const) {
      const store = useDashboardStore.getState();
      expect(store.drawerOpen[mode].bottom).toBe(false);
      store.setMode(mode);
      store.select({ kind: mode === "fact" ? "fact" : "entity", id: "detail" });
      store.setDrawerOpen(mode, "right", false);
      expect(useDashboardStore.getState().detailsOpen).toBe(true);
    }
  });
});
