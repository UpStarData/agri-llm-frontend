import { PathLayer } from "@deck.gl/layers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  relationColor,
  relationDomainInfo,
} from "../src/utils/relationFilters";
import {
  createRelationLayers as buildRelationLayers,
  prepareRelationPaths,
  createRelationFlowLayer,
  relationPath,
  revealRelationLayers,
} from "../src/utils/relationLayers";
import { useDashboardStore } from "../src/store";
import type { Entity, Relation } from "../src/types";

// 目录 /relation-types 下发的关系类型 ID（UUID v7，语义 key 已退役）
const SUPPLIES_TYPE_ID = "01a12521-7294-71a5-99f1-0ed778a2428f";
// 目录 /entity-categories 下发的二级分类 ID（UUID v7）
const MARKET_CATEGORY_ID = "01a12521-7294-71a5-99f1-0ed778a2c0de";

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
    type: MARKET_CATEGORY_ID,
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
    type: SUPPLIES_TYPE_ID,
    scopeLayer: "global",
    factIds: ["f1"],
    involved_varieties: ["cherry"],
  },
  {
    id: "hn-hx",
    sourceId: "hn",
    targetId: "hx",
    type: SUPPLIES_TYPE_ID,
    scopeLayer: "hunan",
    factIds: ["f2", "f3"],
    involved_varieties: ["durian"],
  },
];
const options = {
  entities: nodes,
  relations: edges,
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
  it("目录 typeId 使用目录颜色域", () => {
    expect(relationColor(SUPPLIES_TYPE_ID, {
      version: "RT-v1",
      types: [{ id: SUPPLIES_TYPE_ID, name: "供应", colorDomain: "production_supply",
        directed: true, sourceCategoryIds: [], targetCategoryIds: [] }],
    })).toEqual([255, 209, 102]);
  });
  it("直接显示后端筛选结果，保留跨区域外部端点及其真实层级", () => {
    const entities = nodes.map((node): Entity => ({
      ...node, viewLevels: node.id === "cl" ? ["global"] : ["global", "china", "hunan"],
    }));
    const layers = createRelationLayers({ ...options, entities,
      relations: edges.map((edge) => ({ ...edge, displayLevels: ["global"] })),
    });
    expect(edgeData(layers).map((edge) => edge.id)).toEqual(["cl-hx", "hn-hx"]);
    expect((layers.find((layer) => layer.id === "real-entities")!.props.data as Entity[])
      .map((node) => node.id)).toEqual(["cl", "hx", "hn"]);
    // 关闭跨区域后的响应只含本地节点与线；重点本体不能恢复后端已排除的数据。
    const local = createRelationLayers({ ...options, entities: entities.filter((node) => node.id !== "cl"),
      relations: [edges[1]], focusEntityIds: ["cl"],
    });
    expect(edgeData(local).map((edge) => edge.id)).toEqual(["hn-hx"]);
  });
  it("先定节点再定线，缺失或无坐标端点及小于8px的关系不强行上图", () => {
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
    expect(edgeData(createRelationLayers({ ...options, entities: nodes.filter((node) => node.id !== "cl"),
      focusEntityIds: ["cl"],
    })).map((edge) => edge.id)).toEqual(["hn-hx"]);
  });
  it.each([7.99, 8, 8.01])("端点投影距离 %s px 遵守严格小于8px阈值", (distance) => {
    const layers = createRelationLayers({ ...options, relations: [edges[1]],
      project: ([lng]) => [(lng - 112) * distance, 0],
    });
    expect(edgeData(layers)).toHaveLength(distance < 8 ? 0 : 1);
  });
  it("六域颜色、事实数三档线宽不被最小宽度或高亮覆盖", () => {
    const domains = Object.keys(relationDomainInfo);
    const counts = [0, 1, 2, 4, 5, 20];
    const layers = createRelationLayers({ ...options, glowingRelationIds: domains,
      relations: domains.map((colorDomain, index) => ({ ...edges[1], id: colorDomain,
        colorDomain, supportFactCount: counts[index],
      })),
    });
    const line = layers.find((layer) => layer.id === "real-relations")!;
    const data = line.props.data as (Relation & { color: number[]; width: number })[];
    expect(data.map((edge) => edge.color.slice(0, 3))).toEqual(domains.map((domain) => relationDomainInfo[domain].color));
    expect(data.map((edge) => edge.width)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(line.props.widthMinPixels).toBe(1);
  });
  it("无向关系双向流动且无箭头，业务曲线可拾取，装饰不可拾取", () => {
    const layers = createRelationLayers({
      ...options,
      relations: [{ ...edges[0], directed: false }],
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
      createRelationLayers(options).find((l) => l.id === "relation-arrows"),
    ).toBeUndefined();
  });
  it.each([true, false])("directed=%s 的流光沿同一曲线正向或双向持续运动", (directed) => {
    const layers = createRelationLayers({ ...options, relations: [{ ...edges[1], directed }] });
    const path = relationPath(nodes[3].position!, nodes[2].position!, false);
    type Particle = { position: number[]; progress: number; reverse: boolean };
    const before = createRelationFlowLayer(layers, 0.25).props.data as Particle[];
    const after = createRelationFlowLayer(layers, 0.75).props.data as Particle[];
    expect(before).toHaveLength(directed ? 1 : 2);
    expect(before.map((particle) => particle.reverse)).toEqual(directed ? [false] : [false, true]);
    for (const [index, particle] of after.entries()) {
      expect(particle.position).not.toEqual(before[index].position);
      const progress = particle.reverse ? 1 - particle.progress : particle.progress;
      const sample = progress * (path.length - 1);
      const from = Math.min(path.length - 2, Math.floor(sample));
      particle.position.forEach((value, axis) => {
        expect(value).toBeCloseTo(path[from][axis] + (path[from + 1][axis] - path[from][axis]) * (sample - from));
      });
    }
  });
  it("每条线及双向流光都有独立时序，重排与重绘保持稳定", () => {
    const relations = Array.from({ length: 12 }, (_, index) => ({ ...edges[1], id: `flow-${index}`, directed: false }));
    const layers = createRelationLayers({ ...options, relations });
    type Particle = { relationId: string; reverse: boolean; progress: number; path: number[][] };
    const sample = (time: number, input = layers) => createRelationFlowLayer(input, time).props.data as Particle[];
    const particles = sample(10);
    expect(new Set(particles.map((p) => p.progress)).size).toBe(24);
    const next = sample(10.001);
    const speeds = particles.map((p, i) => ((next[i].progress - p.progress + 1) % 1) / 0.001);
    expect(new Set(speeds.map((speed) => speed.toFixed(6))).size).toBe(24);
    const reordered = sample(10, createRelationLayers({ ...options, relations: [...relations].reverse() }));
    for (const particle of particles) {
      expect(reordered.find((p) => p.relationId === particle.relationId && p.reverse === particle.reverse)).toEqual(particle);
      expect(particle.path).toHaveLength(33);
    }
    expect(sample(10)).toEqual(particles);
  });
  it("连续时间越过原先的2.4秒全局周期时不会所有线一起复位", () => {
    const layers = createRelationLayers(options);
    const before = createRelationFlowLayer(layers, 2.399).props.data as { progress: number }[];
    const after = createRelationFlowLayer(layers, 2.401).props.data as { progress: number }[];
    before.forEach((particle, index) => {
      const distance = Math.abs(particle.progress - after[index].progress);
      expect(Math.min(distance, 1 - distance)).toBeLessThan(0.002);
    });
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
    expect(line.props.widthMinPixels).toBe(1);
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
    expect(flat[32][1]).toBeGreaterThan(28);
    expect(flat[32][2]).toBe(0);
    const globe = relationPath([112, 28], [114, 28], true);
    expect(globe[0][2]).toBe(0);
    expect(globe.at(-1)![2]).toBeCloseTo(0);
    expect(globe[32][2]).toBeGreaterThan(0);
  });
});
describe("关联上下文与详情", () => {
  beforeEach(() =>
    useDashboardStore.setState(useDashboardStore.getInitialState(), true),
  );
  it("跨区域默认开启，用户关闭后切换业务模式仍保留选择", () => {
    const store = useDashboardStore.getState();
    expect(store.relationFilters.crossRegion).toBe(true);
    store.setRelationFilters({ crossRegion: false });
    store.setMode("fact");
    store.setMode("relation");
    expect(useDashboardStore.getState().relationFilters.crossRegion).toBe(false);
  });
  it("事实上下文进入不带入事实地域，返回恢复；同上下文不重建", () => {
    const store = useDashboardStore.getState();
    store.setFactRegion("CN", "430000");
    // 区域筛选不再移动地图，取景由地图自己切换，返回时同样要恢复。
    store.setRegion("province", "430000");
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
    store.setRelationFilters({ excludedTypes: [SUPPLIES_TYPE_ID] });
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
  it("支撑事实在当前tab中打开，详情区最多并排两个", () => {
    const store = useDashboardStore.getState();
    store.setMode("relation");
    store.select({ kind: "entity", id: "e1" });
    store.pushDetail({ kind: "relation", id: "r1" });
    expect(useDashboardStore.getState().detailStack).toEqual([
      { kind: "entity", id: "e1" },
      { kind: "relation", id: "r1" },
    ]);
    store.pushDetail({ kind: "fact", id: "f1" });
    expect(useDashboardStore.getState().mode).toBe("relation");
    expect(useDashboardStore.getState().detailStack).toEqual([
      { kind: "relation", id: "r1" },
      { kind: "fact", id: "f1" },
    ]);
    store.backDetail();
    expect(useDashboardStore.getState().selection).toEqual({
      kind: "relation",
      id: "r1",
    });
  });
  it("重新打开同类详情只留最新一层", () => {
    const store = useDashboardStore.getState();
    store.setMode("relation");
    store.select({ kind: "entity", id: "e1" });
    store.pushDetail({ kind: "fact", id: "f1" });
    store.pushDetail({ kind: "entity", id: "e2" });
    expect(useDashboardStore.getState().detailStack).toEqual([
      { kind: "entity", id: "e2" },
    ]);
    expect(useDashboardStore.getState().highlightedEntityId).toBe("e2");
  });
});

describe("地图路径缓存", () => {
  it("拖动复用路径坐标，动画只构造流光", () => {
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
  it("球体转动时背面端点与投影长度不改变关系集合或流光位置", () => {
    const paths = prepareRelationPaths(nodes, edges, true, false);
    const first = buildRelationLayers({ ...options, isGlobe: true, paths, longitude: 113, latitude: 28,
      project: ([lng, lat]) => [lng, lat], width: 1200, height: 800,
    });
    const moved = buildRelationLayers({ ...options, isGlobe: true, paths, longitude: -60, latitude: -28,
      project: () => [0, 0], width: 1200, height: 800,
    });
    const firstEdge = first.find((layer) => layer.id === "real-relations")!;
    const movedEdge = moved.find((layer) => layer.id === "real-relations")!;
    expect(firstEdge.props.data).toHaveLength(2);
    expect(movedEdge.props.data).toHaveLength(2);
    expect(movedEdge.props.dataComparator!(movedEdge.props.data, firstEdge.props.data)).toBe(true);
    expect(createRelationFlowLayer(moved, 10).props.data).toEqual(createRelationFlowLayer(first, 10).props.data);
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
    // 世界与区域视角共用原始经纬度，不再压缩路径。
    expect(newPaths.get("cl-hx")).toEqual(paths.get("cl-hx"));
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


describe("关系线从起点向终点绘制", () => {
  const path = [[0, 0, 0], [10, 10, 100], [20, 0, 0]];
  const edges = Array.from({ length: 6 }, (_, index) => ({
    id: String(index), path, color: [20, 150, 100, 255], directed: true,
  }));
  const layer = new PathLayer({ id: "real-relations", data: edges });
  const drawn = (seconds: number) => revealRelationLayers([layer], seconds)[0].props.data as typeof edges;
  it("首帧不显示整线，首批从源端连续延伸，第六条延迟启动", () => {
    expect(drawn(0)).toHaveLength(0);
    const early = drawn(0.12);
    expect(early).toHaveLength(5);
    expect(early[0].path[0]).toEqual(path[0]);
    expect(early[0].path.at(-1)).toEqual([2, 2, 20]);
    expect(drawn(0.3)).toHaveLength(6);
    expect(drawn(0.6)[0].path.at(-1)).toEqual(path[1]);
    expect(edges[0].path).toBe(path);
  });
  it("到达终点后保留完整线条，减少动态效果时直接展示", () => {
    expect(drawn(2)[0]).toBe(edges[0]);
    expect(drawn(2)[5].path.at(-1)).toEqual(path[2]);
    expect(revealRelationLayers([layer], Infinity)[0]).toBe(layer);
  });
  it("绘制途中不提前在终点播放流光", () => {
    expect(createRelationFlowLayer(revealRelationLayers([layer], 0.6), 1).props.data).toHaveLength(0);
    expect(createRelationFlowLayer(revealRelationLayers([layer], 2), 2).props.data).toHaveLength(6);
  });
});
