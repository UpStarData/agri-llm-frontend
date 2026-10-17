import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { ColorTheme, Entity, Relation, Position, Selection } from "@/types";
import { relationColor, relationTypeInfo } from "./relationFilters";
import { flattenWorldPosition, MAP_POINT_LINE_COLOR, MAP_POINT_RADIUS } from "./map";
import { ECOLOGY_THEME, rgb, type RGB } from "./ecologyTheme";
import type { RelationTypeCatalog } from "@/api/relation";

interface IOptions {
  pointScale?: number;
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
  glowingRelationIds?: string[];
  width?: number;
  height?: number;
  project?: (position: number[]) => number[];
  select: (selection: Selection) => void;
  relationTypes?: RelationTypeCatalog;
  categoryColors?: Map<string, RGB>;
}
const radians = Math.PI / 180;
const validPosition = (p: Position | null): p is Position =>
  Boolean(p && p.length === 2 && p.every(Number.isFinite));
const vector = ([lng, lat]: Position) => [
  Math.cos(lat * radians) * Math.cos(lng * radians),
  Math.cos(lat * radians) * Math.sin(lng * radians),
  Math.sin(lat * radians),
];
// 底线与流光复用同一条采样路径，避免转动、缩放时偏离。
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
  // 加大侧向弧度，让短途与跨区域关系都呈现舒展的拱形。
  const bend = Math.min(24, distance * 0.34);
  const bendLongitude = distance ? (-latitudeDelta / distance) * bend : 0;
  const bendLatitude = distance ? (longitudeDelta / distance) * bend : 0;
  return Array.from({ length: 65 }, (_, i) => {
    if (i === 0) return [from[0], from[1], 0];
    if (i === 64) return [from[0] + longitudeDelta, to[1], 0];
    const t = i / 64;
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
      globe ? arch * Math.min(3_000_000, angle * 3_800_000) : 0,
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
    const path = paths.get(relation.id);
    if (!path) return [];
    // 球面由海洋深度遮挡处理可见性；端点不可见时高空弧线仍可能可见。
    // 转动中不改变关系集合，避免流光实例被移除、重排和重新创建。
    if (!isGlobe && project) {
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
      widthScale: 0.65,
      opacity: 0.7,
      capRounded: true,
      jointRounded: true,
      billboard: true,
      antialiasing: true,
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
      updateTriggers: { getPosition: flatWorld, getFillColor: options.categoryColors },
      pickable: true,
      getPosition: (e) => transform(e.position!),
      // 所有本体点同一尺寸：选中、枢纽、主题都不改变半径。
      getRadius: MAP_POINT_RADIUS,
      radiusUnits: "pixels",
      radiusScale: options.pointScale ?? 1,
      getFillColor: (entity) => [
        ...(options.categoryColors?.get(entity.type) ?? rgb(ECOLOGY_THEME.factPoint)), 255,
      ],
      stroked: true,
      getLineColor: MAP_POINT_LINE_COLOR,
      lineWidthUnits: "pixels",
      getLineWidth: 1,
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

/** 每批 5 条，每隔 180ms 启动；每条沿缓存路径从源端绘制至目标端。 */
export function revealRelationLayers(layers: Layer[], elapsedSeconds: number): Layer[] {
  if (elapsedSeconds === Infinity) return layers;
  return layers.map((layer) => {
    if (layer.id !== "real-relations") return layer;
    const edges = layer.props.data as { path: number[][]; [key: string]: unknown }[];
    const data = edges.flatMap((edge, index) => {
      const progress = Math.min(1, Math.max(0, (elapsedSeconds - Math.floor(index / 5) * 0.18) / 1.2));
      if (progress <= 0) return [];
      if (progress >= 1) return [edge];
      const lastIndex = Math.floor(progress * (edge.path.length - 1));
      return [{
        ...edge,
        drawing: true,
        path: [...edge.path.slice(0, lastIndex + 1), at(edge.path, progress)],
      }];
    });
    return layer.clone({ data });
  });
}

// 按关系 ID 和方向生成稳定的伪随机时序，筛选、重绘不会重新抽签。
function flowTiming(id: string, reverse: boolean) {
  let seed = 2166136261;
  for (const char of `${id}:${reverse ? "reverse" : "forward"}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return { offset: random() * 6, duration: 2.4 + random() * 1.8 };
}

/** 动画只截取流光段；时间必须连续，不能使用所有线同步归零的全局相位。 */
export function createRelationFlowLayer(layers: Layer[], elapsedSeconds: number) {
  const edges = layers.find((layer) => layer.id === "real-relations")?.props
    .data as
    | {
        id: string;
        path: number[][];
        color: [number, number, number, number];
        directed: boolean;
        drawing?: boolean;
      }[]
    | undefined;
  // 一次流动覆盖约 22% 的曲线。尾端透明、主体渐宽、前端收尖。
  // 起点处截短尾迹，避免循环时跨越首尾产生贯穿地图的直线。
  const particles = (edges ?? []).filter((edge) => !edge.drawing).flatMap((edge) =>
    (edge.directed ? [false] : [false, true]).map((reverse) => {
      const { offset, duration } = flowTiming(edge.id, reverse);
      const progress = ((Math.max(0, elapsedSeconds) + offset) % duration) / duration;
      const start = Math.max(0, progress - 0.22);
      const path: number[][] = [];
      const colors: [number, number, number, number][] = [];
      const widths: number[] = [];
      for (let i = 0; i <= 32; i++) {
        const t = i / 32;
        const sample = start + (progress - start) * t;
        path.push(at(edge.path, reverse ? 1 - sample : sample));
        colors.push([
          edge.color[0], edge.color[1], edge.color[2],
          Math.round(edge.color[3] * Math.pow(t, 0.65)),
        ]);
        widths.push(t < 0.82 ? 0.5 + 4 * (t / 0.82) : 4.5 * (1 - t) / 0.18);
      }
      return {
        relationId: edge.id,
        reverse,
        progress,
        position: at(edge.path, reverse ? 1 - progress : progress),
        color: edge.color,
        path,
        colors,
        widths,
      };
    }),
  );
  return new PathLayer({
    id: "relation-flow",
    data: particles,
    pickable: false,
    // 已沿底线采样，跳过二次路径归一化，保持逐顶点颜色/宽度一一对应。
    _pathType: "open",
    getPath: (d) => d.path.flat(),
    getColor: (d) => d.colors,
    getWidth: (d) => d.widths,
    widthUnits: "pixels",
    capRounded: true,
    jointRounded: true,
    billboard: true,
    antialiasing: true,
  });
}
