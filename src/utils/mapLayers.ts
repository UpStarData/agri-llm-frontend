import { ECOLOGY_THEME as eco, factIntensityColor, rgb, rgba } from "./ecologyTheme";
import type { RGB } from "./ecologyTheme";
import { regionColorIndices } from "./regionColoring";
import {
  GeoJsonLayer,
  PathLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { FactPoint } from "../api/fact";
import { impactCircle, distanceKm } from "./impact";
import { flattenWorldPosition, getMapPointScale } from "./map";
import type {
  Boundaries,
  ColorTheme,
  MapData,
  MapMarker,
  MapOverlayType,
  Mode,
  Selection,
  Position,
} from "../types";

/**
 * 事实星点半径（px）。同一区域层级下所有事实点共用这一个值：
 * 重叠展开只改位置，不改半径；跨层级的大小差异由 radiusScale(getMapPointScale) 提供。
 */
export const FACT_POINT_RADIUS = 5;

const EMPTY: MapData = {
  datasetVersion: "",
  facts: [],
  entities: [],
  relations: [],
  truncated: false,
};
// 分区色只用于区分地理区域，不代表业务数据大小。
// 亮色用规格色板，由 regionColoring 按边界邻接关系分配，保证相邻区域异色；
// 暗色保持原有配色与原有的哈希分配，不随亮色改动。
const LAND_PALETTES: Record<ColorTheme, [number, number, number][]> = {
  light: eco.landPalette.map(rgb),
  dark: [[50, 75, 82], [72, 73, 70], [49, 76, 73], [70, 62, 77], [48, 64, 88], [61, 77, 69]],
};
export function getLandColor(region: string, theme: ColorTheme): [number, number, number] {
  const hash = Array.from(region).reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
  const palette = LAND_PALETTES[theme];
  return palette[hash % palette.length];
}
const MAP_COLORS: Record<
  ColorTheme,
  {
    worldFill: [number, number, number];
    worldLine: [number, number, number] | [number, number, number, number];
    chinaFill: [number, number, number];
    chinaSelected: [number, number, number];
    chinaLine: [number, number, number] | [number, number, number, number];
    fact: [number, number, number];
    relation: [number, number, number, number];
    entity: [number, number, number];
  }
> = {
  dark: {
    worldFill: [31, 44, 64],
    worldLine: [74, 145, 193],
    chinaFill: [35, 56, 79],
    chinaSelected: [38, 101, 182],
    chinaLine: [105, 205, 234],
    fact: [57, 163, 255],
    relation: [221, 174, 99, 150],
    entity: [239, 185, 102],
  },
  light: {
    worldFill: rgb(eco.land),
    worldLine: rgba(eco.borderCountry, 140),
    chinaFill: rgb(eco.land),
    chinaSelected: rgb(eco.selected),
    chinaLine: rgba(eco.borderCountry, 140),
    fact: rgb(eco.production),
    relation: rgba(eco.route, 170),
    entity: rgb(eco.production),
  },
};
export function createMapLayers({
  world,
  china,
  points = [],
  glowingFactIds = [],
  selectedFactId,
  regionId,
  level,
  mode,
  colorTheme,
  data = EMPTY,
  overlayVisibility = { ports: false, factSources: false, influence: false },
  select,
  selectCountry,
  selectProvince,
  flatWorld = false,
}: {
  world?: Boundaries;
  china?: Boundaries;
  points?: FactPoint[];
  glowingFactIds?: string[];
  selectedFactId?: string;
  regionId?: string;
  level: string;
  mode: Mode;
  colorTheme: ColorTheme;
  data?: Pick<MapData, "entities" | "relations" | "overlays">;
  overlayVisibility?: Record<MapOverlayType, boolean>;
  select: (selection: Selection) => void;
  selectCountry?: (id: string) => void;
  selectProvince: (id: string) => void;
  flatWorld?: boolean;
}): Layer[] {
  const position = (point: Position): Position =>
    flatWorld ? flattenWorldPosition(point) : point;
  const colors = MAP_COLORS[colorTheme];
  const palette = LAND_PALETTES[colorTheme];
  // world 与 china 的 regionId 空间不重叠，两张索引表可以合并成一次查表。
  // 只有亮色走邻接着色，暗色仍旧按哈希分配。
  const landIndices = colorTheme === "dark"
    ? undefined
    : new Map([
        ...regionColorIndices(world, palette.length),
        ...regionColorIndices(china, palette.length),
      ]);
  const landFill = (regionId: unknown, fallback: RGB): RGB => {
    if (regionId === undefined || regionId === null) return fallback;
    const key = String(regionId);
    if (!landIndices) return getLandColor(key, colorTheme);
    const index = landIndices.get(key);
    return index === undefined ? fallback : palette[index];
  };
  const glowing = new Set(glowingFactIds);
  const ports = data.overlays?.ports ?? [];
  const factSources = data.overlays?.factSources ?? [];
  return [
    new GeoJsonLayer({
      id: "world-boundaries",
      data: world,
      pickable: true,
      autoHighlight: true,
      highlightColor: colorTheme === "light" ? rgba(eco.landHover, 255) : [92, 210, 200, 115],
      filled: true,
      stroked: true,
      getFillColor: (f) => [
        ...(level === "country" && f.properties?.regionId === regionId
          ? colors.chinaSelected
          : landFill(f.properties?.regionId, colors.worldFill)),
        colorTheme === "light" && f.properties?.regionId === regionId ? 170 : 255,
      ],
      getLineColor: colors.worldLine,
      lineWidthMinPixels: 0.5,
      updateTriggers: { getFillColor: [level, regionId, colorTheme], getLineColor: colorTheme },
      onClick: ({ object }) => {
        if (object?.properties?.regionId)
          selectCountry?.(object.properties.regionId);
      },
    }),
    new GeoJsonLayer({
      id: "china-boundaries",
      data: china,
      visible:
        level === "province" || (level === "country" && regionId === "CN"),
      pickable: true,
      autoHighlight: true,
      highlightColor: colorTheme === "light" ? rgba(eco.landHover, 255) : [92, 210, 200, 115],
      filled: true,
      stroked: true,
      getFillColor: (f) => [
        ...(f.properties?.regionId === regionId
          ? colors.chinaSelected
          : landFill(f.properties?.regionId, colors.chinaFill)),
        colorTheme === "light" && f.properties?.regionId === regionId ? 170 : 255,
      ],
      getLineColor: colors.chinaLine,
      lineWidthMinPixels: 0.7,
      updateTriggers: { getFillColor: [regionId, colorTheme], getLineColor: colorTheme },
      onClick: ({ object }) => {
        if (object?.properties?.regionId && object.properties.name)
          selectProvince(object.properties.regionId);
      },
    }),
    new ScatterplotLayer<FactPoint>({
      id: "live-fact-glow",
      data: points,
      visible: mode === "fact",
      pickable: false,
      getPosition: (point) => position(point.geoPoint),
      getRadius: (point) => glowing.has(point.factId) ? 16 : 0,
      radiusUnits: "pixels",
      getFillColor: colorTheme === "light" ? [255, 160, 20, 70] : [255, 218, 90, 85],
      stroked: true,
      getLineColor: [255, 190, 50, 210],
      getLineWidth: (point) => glowing.has(point.factId) ? 2 : 0,
      lineWidthUnits: "pixels",
      transitions: { getRadius: 450 },
      updateTriggers: { getPosition: flatWorld, getRadius: glowingFactIds, getLineWidth: glowingFactIds },
    }),
    new ScatterplotLayer<FactPoint>({
      id: "real-facts",
      data: points,
      visible: mode === "fact",
      pickable: true,
      getPosition: (d) => position(d.geoPoint),
      getRadius: FACT_POINT_RADIUS,
      radiusScale: getMapPointScale(level),
      radiusUnits: "pixels",
      // 星点按 intensity 着色：热度低偏灰，缺省时保留白色主题色。
      getFillColor: (point: FactPoint) => glowing.has(point.factId) ? [255, 225, 100, 255] : factIntensityColor(point.intensity),
      transitions: { getFillColor: 450 },
      stroked: true,
      getLineColor: [0, 0, 0, 255],
      getLineWidth: (point) => point.factId === selectedFactId ? 2 : 1,
      lineWidthUnits: "pixels",
      updateTriggers: { getPosition: flatWorld, getFillColor: glowingFactIds, getLineWidth: [colorTheme, selectedFactId] },
      onClick: ({ object }) => {
        if (object) select({ kind: "fact", id: object.factId });
      },
    }),
    new ScatterplotLayer<MapMarker>({
      id: "overlay-ports",
      data: ports,
      visible: mode === "fact" && overlayVisibility.ports,
      pickable: true,
      getPosition: (d) => position(d.position),
      getRadius: 7,
      radiusUnits: "pixels",
      getFillColor: colorTheme === "light" ? rgba(eco.hub, 235) : [81, 175, 230, 220],
      getLineColor: colorTheme === "light" ? rgba(eco.panel, 255) : [235, 249, 255, 245],
      updateTriggers: { getFillColor: colorTheme, getLineColor: colorTheme, getPosition: flatWorld },
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1,
    }),
    ...(mode === "fact" && overlayVisibility.ports && ports.length
      ? [
          new TextLayer<MapMarker>({
            id: "overlay-port-labels",
            data: ports,
            visible: mode === "fact" && overlayVisibility.ports,
            pickable: false,
            getPosition: (d) => position(d.position),
            getText: (d) => d.name,
            characterSet: "auto",
            fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
            getSize: 12,
            sizeUnits: "pixels",
            getPixelOffset: [0, 17],
            getTextAnchor: "middle",
            updateTriggers: { getColor: colorTheme, getPosition: flatWorld },
            getColor: colorTheme === "dark" ? [226, 241, 247] : rgb(eco.text),
          }),
        ]
      : []),
    new ScatterplotLayer<MapMarker>({
      id: "overlay-fact-sources",
      data: factSources,
      visible: mode === "fact" && overlayVisibility.factSources,
      pickable: true,
      getPosition: (d) => position(d.position),
      getRadius: 6,
      radiusUnits: "pixels",
      getFillColor: colorTheme === "light" ? rgba(eco.production, 230) : [245, 171, 91, 220],
      updateTriggers: { getFillColor: colorTheme, getPosition: flatWorld },
    }),
    ...(mode === "fact" && overlayVisibility.factSources && factSources.length
      ? [
          new TextLayer<MapMarker>({
            id: "overlay-source-labels",
            data: factSources,
            visible: mode === "fact" && overlayVisibility.factSources,
            pickable: false,
            getPosition: (d) => position(d.position),
            getText: (d) => d.name,
            characterSet: "auto",
            fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
            getSize: 11,
            sizeUnits: "pixels",
            getPixelOffset: [0, 16],
            getTextAnchor: "middle",
            updateTriggers: { getColor: colorTheme, getPosition: flatWorld },
            getColor: colorTheme === "dark" ? [255, 219, 176] : rgb(eco.text),
          }),
        ]
      : []),
  ];
}

/**
 * 影响圆的显示半径系数：接口给的是影响半径，直接画会铺得很开，视觉上收一点。
 * 数据本身不受影响，只改这里的显示比例。
 */
export const INFLUENCE_RADIUS_SCALE = 0.75;
/** 同时存在的扩散波前数，不含始终可见的范围边界圈。 */
export const INFLUENCE_RIPPLE_COUNT = 2;
/** 波纹每段的目标像素长度，段数按屏幕尺寸自适应。 */
const RING_SEGMENT_PIXELS = 3;
const RING_SEGMENT_MIN = 12;
const RING_SEGMENT_MAX = 96;

/**
 * 影响圆的采样段数。球体上典型的影响圆只有几像素，固定 96 段会让每段不足 0.5px，
 * 重叠的圆角接点互相打架，既看不出更圆，又要在每帧重切上万条线段。
 */
export function influenceRingSegments(radiusKm: number, kmPerPixel: number): number {
  const pixels = radiusKm / Math.max(kmPerPixel, 1e-9);
  return Math.min(
    RING_SEGMENT_MAX,
    Math.max(RING_SEGMENT_MIN, Math.round(2 * Math.PI * pixels / RING_SEGMENT_PIXELS)),
  );
}

/** 一组影响圆的圆心：同一片区域的事实共用一个，半径取该组最大值。 */
export interface InfluenceCenter {
  geoPoint: Position;
  radiusKm: number;
}

/**
 * 两个圆心在屏幕上近于这个像素距离就并成一组。
 * 用屏幕距离而不是固定公里数：球体上看东南亚只有几十像素，缩进省级视角后每个产地都该有自己的圈。
 */
const INFLUENCE_MERGE_PIXELS = 24;

/**
 * 把事实点收敛成要画圈的位置：同一坐标先取最大半径，
 * 再把挤在一起的圆心并成一组，落在半径最大的那条事实上。
 * 接口经常把十几条事实放在同一个坐标上，逐个画圈会在同一片区域叠出十几条同心圆。
 * 判定用「屏幕上离得近」或「圈本身已经重叠」两条：前者管球体上糊成一片，
 * 后者管缩进省级视角后几个大圈套在一起。
 */
export function influenceCenters(points: FactPoint[], kmPerPixel: number): InfluenceCenter[] {
  const byCoordinate = new Map<string, InfluenceCenter>();
  for (const point of points) {
    const radiusKm = point.impactRadiusKm;
    if (!Number.isFinite(radiusKm) || !(radiusKm! > 0)) continue;
    const key = point.geoPoint.join(",");
    const found = byCoordinate.get(key);
    if (found) found.radiusKm = Math.max(found.radiusKm, radiusKm!);
    else byCoordinate.set(key, { geoPoint: point.geoPoint, radiusKm: radiusKm! });
  }
  const screenKm = INFLUENCE_MERGE_PIXELS * Math.max(kmPerPixel, 1e-6);
  // 从半径最大的开始扫，组长就是该片区域最主要的那条事实，后续成员不再改变圆心。
  return [...byCoordinate.values()]
    .sort((left, right) => right.radiusKm - left.radiusKm)
    .reduce<InfluenceCenter[]>((groups, location) => {
      const merged = groups.some((group) => {
        const radiusKm = Math.max(group.radiusKm, location.radiusKm) * INFLUENCE_RADIUS_SCALE;
        return distanceKm(group.geoPoint, location.geoPoint) < Math.max(screenKm, radiusKm);
      });
      if (!merged) groups.push(location);
      return groups;
    }, []);
}

/** 影响圆独立更新，不让动画触发地理底图和事实点的重建。 */
export function createInfluenceLayers(
  points: FactPoint[],
  phase: number,
  flatWorld: boolean,
  colorTheme: ColorTheme = "dark",
  kmPerPixel = 1,
): Layer[] {
  const centers = influenceCenters(points, kmPerPixel);
  const color = colorTheme === "light" ? rgb(eco.priorityRoute) : [255, 157, 86] as [number, number, number];
  // 段数按整圈的最终半径算，扩散过程中不会来回变段数。
  const radius = (center: InfluenceCenter) => center.radiusKm * INFLUENCE_RADIUS_SCALE;
  const segments = new Map(centers.map((center) => [
    center,
    influenceRingSegments(radius(center), kmPerPixel),
  ]));
  const path = (center: InfluenceCenter, progress: number) =>
    impactCircle(center.geoPoint, radius(center) * progress, segments.get(center)).map(
      (position) => flatWorld ? flattenWorldPosition(position) : position,
    );
  // 缩放只影响采样密度，量化后当作更新触发器，避免拖动时反复重切几何。
  const density = Math.round(Math.log2(Math.max(kmPerPixel, 1e-9)) * 4);
  const ripples = Array.from({ length: INFLUENCE_RIPPLE_COUNT }, (_, index) => {
    const progress = (phase + index / INFLUENCE_RIPPLE_COUNT) % 1;
    // 波前由中心向外扩散，出生与消失时都透明，循环时不会突然闪跳。
    return new PathLayer<InfluenceCenter>({
      id: `overlay-influence-ripple-${index}`,
      data: centers,
      pickable: false,
      getPath: (center) => path(center, progress),
      wrapLongitude: true,
      widthUnits: "pixels",
      getWidth: 2.2 * (1 - progress * 0.5),
      getColor: [...color, Math.round(Math.sin(Math.PI * progress) ** 1.4 * 210)],
      capRounded: true,
      jointRounded: true,
      parameters: { cullMode: "none", depthWriteEnabled: false },
      updateTriggers: { getPath: [progress, flatWorld, density], getColor: [progress, colorTheme] },
    });
  });
  // 范围边界圈几何恒定，只在投影或缩放跨度变化时重切一次。
  const boundary = new PathLayer<InfluenceCenter>({
    id: "overlay-influence-boundary",
    data: centers,
    pickable: false,
    getPath: (center) => path(center, 1),
    wrapLongitude: true,
    widthUnits: "pixels",
    getWidth: 1,
    getColor: [...color, 45],
    capRounded: true,
    jointRounded: true,
    parameters: { cullMode: "none", depthWriteEnabled: false },
    updateTriggers: { getPath: [flatWorld, density], getColor: [colorTheme] },
  });
  return [...ripples, boundary];
}

/**
 * 把重叠事实的展开坐标写回事实点图层。
 * 只替换 getPosition：半径始终是 FACT_POINT_RADIUS，不会被展开与否影响；
 * 跨层级的整体大小差异由 radiusScale(pointScale) 统一提供。
 */
export function applyFactPointLayout(
  layers: Layer[],
  positions: Map<FactPoint, Position>,
  pointScale: number,
  flatWorld: boolean,
): Layer[] {
  const original = (point: FactPoint): Position =>
    flatWorld ? flattenWorldPosition(point.geoPoint) : point.geoPoint;
  return layers.map((layer) => (layer.id === "real-facts" || layer.id === "live-fact-glow")
    ? (layer as ScatterplotLayer<FactPoint>).clone({
        getPosition: (point: FactPoint) => positions.get(point) ?? original(point),
        radiusScale: pointScale,
        updateTriggers: { ...layer.props.updateTriggers, getPosition: [positions] },
      })
    : layer);
}
