import { WebMercatorViewport } from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import type { Boundary, Boundaries, MapLevel, Position } from "../types";

export const WORLD_VIEW: MapViewState = {
  longitude: 0,
  latitude: 30,
  zoom: 1.3,
  pitch: 0,
  bearing: 0,
  minZoom: 0,
  maxZoom: 12,
};

export const GLOBE_MIN_ZOOM = -1.2;
const GLOBE_RADIUS = 256;
const GLOBE_ALTITUDE = 1.5;
/**
 * 球体的目标占屏比例，按实测反推：拟合公式里的透视与纬度修正还会再压掉约三成，
 * 直接写 0.88 时球体只渲染到短边的 68%，上下各留 139px 空白。
 * 这两个值对应「初始 79px、最大 67px 边距」，约为原来的一半。
 */
const GLOBE_SAFE_RATIO = 1.2;
const GLOBE_INITIAL_RATIO = 1.14;
export function getWheelZoomStep(delta: number): number {
  return Math.sign(delta) * Math.log2(2 / (1 + Math.exp(-Math.abs(delta) * 0.01)));
}
export const MAP_ZOOM_STEP = getWheelZoomStep(100);
export const FLAT_WORLD_PADDING = 32;
// Shift the repeating 2D world window so China sits near the center.
export const FLAT_WORLD_BOUNDS: [Position, Position] = [[-75, -57], [285, 84]];

/** 2D 与 3D 共用原始经纬度，交给视图投影，避免额外压缩纬度。 */
export function flattenWorldPosition(position: Position): Position {
  return position;
}

export function flattenWorldBoundaries(boundaries: Boundaries): Boundaries {
  return {
    ...boundaries,
    features: boundaries.features.filter((feature) => feature.properties.name !== "Antarctica"),
  };
}

/** 同一个多面要素才能在悬停、选择和着色时统一处理中国各区域。 */
export function mergeChinaBoundaries(boundaries: Boundaries): Boundaries {
  const regionIds = new Set(["CN", "TW", "HK", "MO"]);
  const china = boundaries.features.find((feature) => feature.properties.regionId === "CN");
  if (!china) return boundaries;
  const coordinates = boundaries.features
    .filter((feature) => regionIds.has(feature.properties.regionId))
    .flatMap((feature) => feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates] : feature.geometry.coordinates);
  return {
    ...boundaries,
    features: boundaries.features.filter((feature) => !regionIds.has(feature.properties.regionId))
      .concat({ ...china, geometry: { type: "MultiPolygon", coordinates } }),
  };
}

function getWorldFit(width: number, height: number) {
  return new WebMercatorViewport({ width: Math.max(Number.isFinite(width) ? width : 0, 320), height: Math.max(Number.isFinite(height) ? height : 0, 300) })
    .fitBounds([flattenWorldPosition(FLAT_WORLD_BOUNDS[0]), flattenWorldPosition(FLAT_WORLD_BOUNDS[1])], { padding: FLAT_WORLD_PADDING });
}

export function getWorldZoom(width: number, height: number): number {
  return getWorldFit(width, height).zoom;
}

export function isWorldOverviewZoom(level: MapLevel, zoom: number, width: number, height: number): boolean {
  return level !== "world" && zoom <= getWorldZoom(width, height) + 0.001;
}

export const GLOBE_WORLD_LATITUDE = new WebMercatorViewport({ width: 512, height: 512 })
  .fitBounds(FLAT_WORLD_BOUNDS).latitude;

export function getFlatLongitudeLimits(width: number, zoom: number) {
  const halfVisibleLongitude = (width / (512 * 2 ** zoom)) * 180;
  const limit = Math.max(0, 180 - halfVisibleLongitude);
  return { min: -limit, max: limit };
}

/** 循环世界允许连续横向平移，仅限制极区和倾斜。 */
export function clampFlatView(view: MapViewState): MapViewState {
  return {
    ...view,
    latitude: Math.max(-85, Math.min(85, view.latitude)),
    pitch: 0,
    bearing: 0,
  };
}

export function isGlobeMaxZoom(view: MapViewState, width: number, height: number): boolean {
  return view.zoom >= getGlobeZoomLimits(width, height, view.latitude).maxZoom - 0.01;
}

/** GlobeViewport projects a sphere with perspective and latitude-adjusted scale. */
export function getGlobeFitZoom(
  width: number,
  height: number,
  latitude = 0,
  ratio = GLOBE_INITIAL_RATIO,
): number {
  width = Math.max(Number.isFinite(width) ? width : 0, 1);
  height = Math.max(Number.isFinite(height) ? height : 0, 1);
  const diameter = Math.min(width, height) * ratio;
  const perspective = Math.hypot(1, diameter / (2 * height * GLOBE_ALTITUDE));
  const latitudeScale = Math.cos((Math.min(85, Math.max(-85, latitude)) * Math.PI) / 180);
  const zoom = Math.log2(diameter / (2 * GLOBE_RADIUS * perspective)) +
    Math.log2(Math.PI * latitudeScale);
  return Math.max(GLOBE_MIN_ZOOM, zoom);
}

/** The controller applies this latitude offset to its min/max zoom constraints. */
export function getGlobeZoomLimits(width: number, height: number, latitude: number) {
  const maxZoom = getGlobeFitZoom(width, height, 0, GLOBE_SAFE_RATIO);
  const latitudeOffset = Math.log2(
    Math.cos((Math.min(85, Math.max(-85, latitude)) * Math.PI) / 180),
  );
  return { minZoom: GLOBE_MIN_ZOOM + latitudeOffset, maxZoom: maxZoom + latitudeOffset };
}
/** 边界要素的外接矩形，[西南角, 东北角]。 */
export function getBoundaryBounds(feature: Boundary): [Position, Position] {
  let minLongitude = Infinity;
  let minLatitude = Infinity;
  let maxLongitude = -Infinity;
  let maxLatitude = -Infinity;
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      minLongitude = Math.min(minLongitude, node[0]);
      maxLongitude = Math.max(maxLongitude, node[0]);
      minLatitude = Math.min(minLatitude, node[1]);
      maxLatitude = Math.max(maxLatitude, node[1]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(feature.geometry.coordinates);
  return [
    [minLongitude, minLatitude],
    [maxLongitude, maxLatitude],
  ];
}

/** 外接矩形只随边界数据变化，缓存后每次命中判定不必重扫几万个顶点。 */
const boundsIndexCache = new WeakMap<
  Boundaries,
  { feature: Boundary; bounds: [Position, Position] }[]
>();

function boundaryIndex(boundaries: Boundaries) {
  const cached = boundsIndexCache.get(boundaries);
  if (cached) return cached;
  const index = boundaries.features.map((feature) => ({
    feature,
    bounds: getBoundaryBounds(feature),
  }));
  boundsIndexCache.set(boundaries, index);
  return index;
}

/** 射线法：点是否落在单个环内。 */
function ringContainsPosition(
  ring: Position[],
  longitude: number,
  latitude: number,
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    if (
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude
    )
      inside = !inside;
  }
  return inside;
}

/** 点在面内：外环命中且不落在任何内环洞里。 */
function boundaryContainsPosition(
  feature: Boundary,
  [longitude, latitude]: Position,
): boolean {
  const polygons = (
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates
  ) as Position[][][];
  return polygons.some(
    (polygon) =>
      polygon.length > 0 &&
      ringContainsPosition(polygon[0], longitude, latitude) &&
      !polygon
        .slice(1)
        .some((hole) => ringContainsPosition(hole, longitude, latitude)),
  );
}

/**
 * 命中该位置的区域。多块同时命中时取外接矩形最小的一个：
 * 岛屿常常落在大陆的矩形里，取更紧凑的那块才符合直觉。
 */
export function findBoundaryAt(
  boundaries: Boundaries | undefined,
  position: Position,
): Boundary | undefined {
  if (!boundaries) return undefined;
  let found: Boundary | undefined;
  let foundArea = Infinity;
  for (const { feature, bounds } of boundaryIndex(boundaries)) {
    if (
      position[0] < bounds[0][0] ||
      position[0] > bounds[1][0] ||
      position[1] < bounds[0][1] ||
      position[1] > bounds[1][1]
    )
      continue;
    const area = (bounds[1][0] - bounds[0][0]) * (bounds[1][1] - bounds[0][1]);
    if (area >= foundArea) continue;
    if (!boundaryContainsPosition(feature, position)) continue;
    found = feature;
    foundArea = area;
  }
  return found;
}

export function getRegionView(
  level: MapLevel,
  regionId: string | undefined,
  china: Boundaries | undefined,
  width: number,
  height: number,
  world?: Boundaries,
): MapViewState {
  if (level === "world") {
    const view = getWorldFit(width, height);
    return { ...WORLD_VIEW, longitude: view.longitude, latitude: view.latitude,
      zoom: view.zoom, minZoom: view.zoom };
  }
  let bounds: [Position, Position] = [
    [73, 3],
    [135, 54],
  ];
  if (level === "province" || (level === "country" && regionId && regionId !== "CN")) {
    const feature = (level === "province" ? china : world)?.features.find(
      (f) => f.properties.regionId === regionId,
    );
    if (!feature)
      return { ...WORLD_VIEW, longitude: 112, latitude: 28, zoom: 5, minZoom: getWorldZoom(width, height) };
    bounds = getBoundaryBounds(feature);
  }
  const view = new WebMercatorViewport({
    width: Math.max(Number.isFinite(width) ? width : 0, 320),
    height: Math.max(Number.isFinite(height) ? height : 0, 300),
  }).fitBounds(bounds, { padding: 70 });
  return {
    ...WORLD_VIEW,
    longitude: view.longitude,
    latitude: view.latitude,
    zoom: view.zoom,
    minZoom: getWorldZoom(width, height),
  };
}

/** 区域越聚焦，事实和本体标记越大；球体仍采用全球尺寸。 */
export function getMapPointScale(level: string, isGlobe = false): number {
  return isGlobe || level === "world" ? 0.7 : level === "province" ? 1.35 : 1;
}
