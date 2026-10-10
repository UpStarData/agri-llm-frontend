import { WebMercatorViewport } from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import type { Boundaries, MapLevel, Position } from "../types";

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
const GLOBE_SAFE_RATIO = 0.88;
const GLOBE_INITIAL_RATIO = 0.82;
export function getWheelZoomStep(delta: number): number {
  return Math.sign(delta) * Math.log2(2 / (1 + Math.exp(-Math.abs(delta) * 0.01)));
}
export const MAP_ZOOM_STEP = getWheelZoomStep(100);
export const FLAT_WORLD_PADDING = 32;
// Shift the repeating 2D world window so China sits near the center.
export const FLAT_WORLD_BOUNDS: [Position, Position] = [[-75, -57], [285, 84]];

// ECharts' unprojected world map uses latitude linearly. Feed a matching
// latitude into Web Mercator so deck.gl's existing pan/zoom controls still work.
export function flattenWorldPosition([longitude, latitude]: Position): Position {
  return [longitude, Math.atan(Math.sinh(latitude * Math.PI / 180)) * 180 / Math.PI];
}

export function flattenWorldBoundaries(boundaries: Boundaries): Boundaries {
  return {
    ...boundaries,
    features: boundaries.features.filter((feature) => feature.properties.name !== "Antarctica").map((feature) => ({
      ...feature,
      geometry: feature.geometry.type === "Polygon"
        ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map((ring) => ring.map((point) => flattenWorldPosition(point as Position))) }
        : { ...feature.geometry, coordinates: feature.geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map((point) => flattenWorldPosition(point as Position)))) },
    })),
  };
}

function getWorldFit(width: number, height: number) {
  return new WebMercatorViewport({ width: Math.max(width, 1), height: Math.max(height, 1) })
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

/** 以初始视角为中线限制平移，避免循环世界地图被无限拖走。 */
export function clampFlatView(
  view: MapViewState,
  center: MapViewState,
  width: number,
  height: number,
): MapViewState {
  const viewport = new WebMercatorViewport({ ...center, width, height });
  const west = viewport.unproject([width * 0.25, height / 2])[0];
  const south = viewport.unproject([width / 2, height * 0.75])[1];
  const north = viewport.unproject([width / 2, height * 0.25])[1];
  const longitudeRange = Math.min(90, Math.abs(center.longitude - west));
  return {
    ...view,
    longitude: Math.max(center.longitude - longitudeRange, Math.min(center.longitude + longitudeRange, view.longitude)),
    latitude: Math.max(south, Math.min(north, view.latitude)),
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
    [73, 18],
    [135, 54],
  ];
  if (level === "province" || (level === "country" && regionId && regionId !== "CN")) {
    const feature = (level === "province" ? china : world)?.features.find(
      (f) => f.properties.regionId === regionId,
    );
    if (!feature)
      return { ...WORLD_VIEW, longitude: 112, latitude: 28, zoom: 5, minZoom: getWorldZoom(width, height) };
    const positions = (
      feature.geometry.type === "Polygon"
        ? feature.geometry.coordinates.flat()
        : feature.geometry.coordinates.flat(2)
    ) as Position[];
    bounds = [
      [
        Math.min(...positions.map((p) => p[0])),
        Math.min(...positions.map((p) => p[1])),
      ],
      [
        Math.max(...positions.map((p) => p[0])),
        Math.max(...positions.map((p) => p[1])),
      ],
    ];
  }
  const view = new WebMercatorViewport({
    width: Math.max(width, 320),
    height: Math.max(height, 300),
  }).fitBounds(bounds, { padding: 70 });
  return {
    ...WORLD_VIEW,
    longitude: view.longitude,
    latitude: view.latitude,
    zoom: view.zoom,
    minZoom: getWorldZoom(width, height),
  };
}
