import { ECOLOGY_THEME as eco, entityThemeColor, isLogisticsHub, rgba } from "./ecologyTheme";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { ColorTheme, Entity, Relation, Position, Selection } from "@/types";
import { relationColor, relationTypeInfo } from "./relationFilters";
import { flattenWorldPosition } from "./map";
import type { RelationTypeCatalog } from "@/api/relation";

interface IOptions {
  colorTheme?: ColorTheme;
  entities: Entity[];
  relations: Relation[];
  flatWorld: boolean;
  isGlobe: boolean;
  longitude: number;
  latitude: number;
  paths: Map<string, number[][]>;
  highlightedEntityId: string | null;
  focusEntityIds?: string[];
  glowingEntityIds?: string[];
  glowingRelationIds?: string[];
  width?: number;
  height?: number;
  project?: (position: number[]) => number[];
  select: (selection: Selection) => void;
  relationTypes?: RelationTypeCatalog;
}
const radians = Math.PI / 180;
const validPosition = (p: Position | null): p is Position =>
  Boolean(p && p.length === 2 && p.every(Number.isFinite));
const vector = ([lng, lat]: Position) => [
  Math.cos(lat * radians) * Math.cos(lng * radians),
  Math.cos(lat * radians) * Math.sin(lng * radians),
  Math.sin(lat * radians),
];
// 曲线与流动光点使用同一条大圆路径，避免偏离。
export const relationPath = (
  from: Position,
  to: Position,
  globe: boolean,
): number[][] => {
  const a = vector(from),
    b = vector(to);
  const angle = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        a.reduce((sum, n, i) => sum + n * b[i], 0),
      ),
    ),
  );
  let previous = from[0];
  const longitudeDelta = ((to[0] - from[0] + 540) % 360) - 180;
  const latitudeDelta = to[1] - from[1];
  const distance = Math.hypot(longitudeDelta, latitudeDelta);
  // 平面视图给关系线一个轻微的侧向弧度；端点仍精确落在本体上。
  const bend = Math.min(8, distance * 0.16);
  const bendLongitude = distance ? (-latitudeDelta / distance) * bend : 0;
  const bendLatitude = distance ? (longitudeDelta / distance) * bend : 0;
  return Array.from({ length: 33 }, (_, i) => {
    if (i === 0) return [from[0], from[1], 0];
    if (i === 32) return [from[0] + longitudeDelta, to[1], 0];
    const t = i / 32;
    // 重合及对跖点采用经度最短方向插值，避免除零。
    let lng = from[0] + longitudeDelta * t;
    let lat = from[1] + (to[1] - from[1]) * t;
    if (angle > 0.000001 && Math.abs(Math.sin(angle)) > 0.000001) {
      const v = a.map(
        (n, j) =>
          (n * Math.sin((1 - t) * angle) + b[j] * Math.sin(t * angle)) /
          Math.sin(angle),
      );
      lng = Math.atan2(v[1], v[0]) / radians;
      lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / radians;
      while (lng - previous > 180) lng -= 360;
      while (lng - previous < -180) lng += 360;
    }
    previous = lng;
    const arch = Math.sin(Math.PI * t);
    return [
      globe ? lng : lng + bendLongitude * arch,
      globe ? lat : lat + bendLatitude * arch,
      globe ? arch * Math.min(1_200_000, Math.max(40_000, angle * 1_800_000)) : 0,
    ];
  });
};
const at = (path: number[][], phase: number) => {
  const index = Math.min(
    path.length - 2,
    Math.floor(phase * (path.length - 1)),
  );
  const t = phase * (path.length - 1) - index;
  return path[index].map((n, i) => n + (path[index + 1][i] - n) * t);
};
export const createRelationLayers = (options: IOptions): Layer[] => {
  const {
    colorTheme = "dark",
    entities,
    relations,
    flatWorld,
    isGlobe,
    paths,
    highlightedEntityId,
    focusEntityIds = [],
    glowingEntityIds = [],
    glowingRelationIds = [],
    project,
    select,
  } = options;
  const light = colorTheme === "light";
  const focus = new Set(focusEntityIds);
  const neighbors = new Set([highlightedEntityId]);
  relations
    .filter(
      (r) =>
        r.sourceId === highlightedEntityId ||
        r.targetId === highlightedEntityId,
    )
    .forEach((r) => {
      neighbors.add(r.sourceId);
      neighbors.add(r.targetId);
    });
  const transform = (p: number[]): [number, number, number] => {
    const [lng, lat] = flatWorld ? flattenWorldPosition([p[0], p[1]]) : p;
    return [lng, lat, p[2] ?? 0];
  };
  const onScreen = (entity: Entity) => {
    if (!validPosition(entity.position)) return false;
    if (isGlobe) {
      const p = vector(entity.position),
        center = vector([options.longitude, options.latitude]);
      if (p.reduce((sum, n, i) => sum + n * center[i], 0) < 0) return false;
    }
    if (project && options.width && options.height) {
      const [x, y] = project(transform(entity.position));
      if (x < 0 || y < 0 || x > options.width || y > options.height)
        return false;
    }
    return true;
  };
  // 后端已按 view、includeCrossRegion 和业务筛选确定集合；保留外部端点。
  const nodes = entities
    .filter((e) => validPosition(e.position))
    .sort((a, b) =>
      (a.updatedAt ?? a.createdAt ?? "").localeCompare(
        b.updatedAt ?? b.createdAt ?? "",
      ),
    );
  const byId = new Map(nodes.map((e) => [e.id, e]));
  const edges = relations.flatMap((relation) => {
    const from = byId.get(relation.sourceId),
      to = byId.get(relation.targetId);
    if (
      !from ||
      !to ||
      !validPosition(from.position) ||
      !validPosition(to.position)
    )
      return [];
    const important = focus.has(from.id) || focus.has(to.id);
    if (isGlobe && !onScreen(from) && !onScreen(to)) return [];
    const path = paths.get(relation.id);
    if (!path) return [];
    if (project) {
      const a = project(path[0]),
        b = project(path.at(-1)!);
      const pixelLength = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!Number.isFinite(pixelLength) || pixelLength < 8) return [];
    }
    const focused =
      !highlightedEntityId ||
      relation.sourceId === highlightedEntityId ||
      relation.targetId === highlightedEntityId;
    const glowing = glowingRelationIds.includes(relation.id);
    const priority = important || glowing || Boolean(highlightedEntityId && focused);
    const color: [number, number, number, number] = [
      ...relationColor(
        relation.type,
        options.relationTypes,
        relation.colorDomain,
      ),
      light ? (focused ? (priority ? 230 : 165) : 40) : (focused ? 210 : 45),
    ];
    return [
      {
        ...relation,
        name:
          relationTypeInfo(relation.type, options.relationTypes)?.name ??
          relation.type,
        directed:
          relation.directed ??
          relationTypeInfo(relation.type, options.relationTypes)?.directed ??
          true,
        path,
        color,
        width:
          (relation.supportFactCount ?? relation.factIds?.length ?? 0) >= 5
            ? 3
            : (relation.supportFactCount ?? relation.factIds?.length ?? 0) >= 2
              ? 2
              : 1,
      },
    ];
  });
  return [
    new PathLayer({
      id: "real-relations",
      data: edges,
      // 相机移动但可见边及样式不变时，保留 GPU 路径缓冲。
      dataComparator: (newData, oldData) => {
        const next = newData as typeof edges,
          previous = oldData as typeof edges | undefined;
        return Boolean(
          previous &&
          next.length === previous.length &&
          next.every((edge, index) => {
            const old = previous[index];
            return (
              edge.id === old.id &&
              edge.path === old.path &&
              edge.width === old.width &&
              edge.color.every((value, channel) => value === old.color[channel])
            );
          }),
        );
      },
      pickable: true,
      getPath: (d) => d.path,
      getColor: (d) => d.color,
      getWidth: (d) => d.width,
      updateTriggers: { getColor: [colorTheme, highlightedEntityId, focusEntityIds, glowingRelationIds] },
      widthUnits: "pixels",
      widthMinPixels: 1,
      onClick: ({ object }) => {
        if (object) select({ kind: "relation", id: object.id });
      },
    }),
    new ScatterplotLayer<Entity>({
      id: "real-entities",
      data: nodes,
      dataComparator: (newData, oldData) => {
        const next = newData as Entity[],
          previous = oldData as Entity[] | undefined;
        return Boolean(
          previous &&
          next.length === previous.length &&
          next.every((node, index) => node === previous[index]),
        );
      },
      updateTriggers: {
        getPosition: flatWorld,
        getFillColor: [colorTheme, highlightedEntityId, glowingEntityIds, relations],
        getLineColor: [colorTheme, highlightedEntityId],
        getRadius: [colorTheme, highlightedEntityId],
        getLineWidth: [colorTheme, highlightedEntityId],
      },
      pickable: true,
      getPosition: (e) => transform(e.position!),
      getRadius: (e) => light ? (e.id === highlightedEntityId ? 9 : isLogisticsHub(e) ? 7 : 5) : 6,
      radiusUnits: "pixels",
      getFillColor: (e) =>
        light ? rgba(entityThemeColor(e), !highlightedEntityId || neighbors.has(e.id) ? 245 : 60) :
        glowingEntityIds.includes(e.id)
          ? [255, 236, 169, 255]
          : [
              239,
              185,
              102,
              !highlightedEntityId || neighbors.has(e.id) ? 255 : 60,
            ],
      stroked: true,
      getLineColor: (e) =>
        light ? (e.id === highlightedEntityId ? rgba(eco.selected, 140) : isLogisticsHub(e) ? rgba(eco.panel, !highlightedEntityId || neighbors.has(e.id) ? 245 : 60) : rgba(eco.panel, 0)) :
        e.id === highlightedEntityId
          ? [255, 255, 255, 255]
          : [239, 185, 102, 0],
      lineWidthUnits: "pixels",
      getLineWidth: (e) => light ? (e.id === highlightedEntityId ? 5 : isLogisticsHub(e) ? 2 : 0) : 2,
      onClick: ({ object }) => {
        if (object) select({ kind: "entity", id: object.id });
      },
    }),
  ];
};

/** 仅数据/投影模式变化时计算大圆路径，拖动与动画复用同一份坐标。 */
export function prepareRelationPaths(
  entities: Entity[],
  relations: Relation[],
  isGlobe: boolean,
  flatWorld: boolean,
) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const paths = new Map<string, number[][]>();
  for (const relation of relations) {
    const from = byId.get(relation.sourceId)?.position;
    const to = byId.get(relation.targetId)?.position;
    if (!from || !to || !validPosition(from) || !validPosition(to)) continue;
    const path = relationPath(from, to, isGlobe);
    paths.set(
      relation.id,
      flatWorld
        ? path.map(([lng, lat, altitude]) => [
            ...flattenWorldPosition([lng, lat]),
            altitude,
          ])
        : path,
    );
  }
  return paths;
}

/** 动画只更新光点，不重建路径、边界或本体图层。 */
export function createRelationFlowLayer(layers: Layer[], phase: number) {
  const edges = layers.find((layer) => layer.id === "real-relations")?.props
    .data as
    | {
        path: number[][];
        color: [number, number, number, number];
        directed: boolean;
      }[]
    | undefined;
  const particles = (edges ?? []).flatMap((edge) => [
    { position: at(edge.path, phase), color: edge.color },
    ...(!edge.directed
      ? [{ position: at(edge.path, 1 - phase), color: edge.color }]
      : []),
  ]);
  return new ScatterplotLayer({
    id: "relation-flow",
    data: particles,
    pickable: false,
    getPosition: (d) => d.position,
    getFillColor: (d) => d.color,
    getRadius: 2,
    radiusUnits: "pixels",
  });
}
