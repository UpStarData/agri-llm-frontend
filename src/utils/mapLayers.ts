import { ECOLOGY_THEME as eco, rgb, rgba } from "./ecologyTheme";
import {
  GeoJsonLayer,
  PathLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { FactPoint } from "../api/fact";
import { impactCircle } from "./impact";
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

const EMPTY: MapData = {
  datasetVersion: "",
  facts: [],
  entities: [],
  relations: [],
  truncated: false,
};
// 分区色只用于区分地理区域，不代表业务数据大小。
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
    worldLine: [number, number, number];
    chinaFill: [number, number, number];
    chinaSelected: [number, number, number];
    chinaLine: [number, number, number];
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
    worldLine: rgb(eco.borderCountry),
    chinaFill: rgb(eco.land),
    chinaSelected: rgb(eco.selected),
    chinaLine: rgb(eco.borderCountry),
    fact: rgb(eco.production),
    relation: rgba(eco.route, 170),
    entity: rgb(eco.production),
  },
};
export function createMapLayers({
  world,
  china,
  points = [],
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
  const ports = data.overlays?.ports ?? [];
  const factSources = data.overlays?.factSources ?? [];
  return [
    new GeoJsonLayer({
      id: "world-boundaries",
      data: world,
      pickable: true,
      autoHighlight: true,
      highlightColor: colorTheme === "light" ? rgba(eco.selected, 90) : [92, 210, 200, 115],
      filled: true,
      stroked: true,
      getFillColor: (f) => [
        ...(level === "country" && f.properties?.regionId === regionId
          ? colors.chinaSelected
          : f.properties?.regionId
            ? getLandColor(f.properties.regionId, colorTheme)
            : colors.worldFill),
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
      highlightColor: colorTheme === "light" ? rgba(eco.selected, 90) : [92, 210, 200, 115],
      filled: true,
      stroked: true,
      getFillColor: (f) => [
        ...(f.properties?.regionId === regionId
          ? colors.chinaSelected
          : f.properties?.regionId
            ? getLandColor(f.properties.regionId, colorTheme)
            : colors.chinaFill),
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
      id: "real-facts",
      data: points,
      visible: mode === "fact",
      pickable: true,
      getPosition: (d) => position(d.geoPoint),
      getRadius: 5,
      radiusScale: getMapPointScale(level),
      radiusUnits: "pixels",
      getFillColor: [255, 255, 255],
      stroked: colorTheme === "light",
      getLineColor: rgba(eco.selected, 140),
      getLineWidth: (point) => point.factId === selectedFactId ? 4 : 0,
      lineWidthUnits: "pixels",
      updateTriggers: { getFillColor: colorTheme, getPosition: flatWorld, getLineWidth: [colorTheme, selectedFactId] },
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

/** 影响圆独立更新，不让动画触发地理底图和事实点的重建。 */
export function createInfluenceLayers(
  points: FactPoint[],
  phase: number,
  flatWorld: boolean,
  colorTheme: ColorTheme = "dark",
): Layer[] {
  const influence = points.filter(
    (point) =>
      Number.isFinite(point.impactRadiusKm) && point.impactRadiusKm! > 0,
  );
  const color = colorTheme === "light" ? rgb(eco.priorityRoute) : [255, 157, 86] as [number, number, number];
  return [0, 1, 2, 3].flatMap((index) => {
    const progress = index === 3 ? 1 : (phase + index / 3) % 1;
    // 波前由中心向外扩散，出生与消失时都透明，循环时不会突然闪跳。
    const opacity = index === 3 ? 35 : Math.round(Math.sin(Math.PI * progress) ** 1.4 * 210);
    const path = (point: FactPoint) =>
      impactCircle(point.geoPoint, point.impactRadiusKm! * progress).map(
        (position) => flatWorld ? flattenWorldPosition(position) : position,
      );
    return (index === 3 ? [false] : [true, false]).map((glow) => new PathLayer<FactPoint>({
      id: `overlay-influence-${glow ? "glow" : "ring"}-${index}`,
      data: influence,
      pickable: false,
      getPath: path,
      wrapLongitude: true,
      widthUnits: "pixels",
      getWidth: index === 3 ? 1 : (glow ? 9 : 2.5) * (1 - progress * 0.5),
      getColor: [...color, glow ? Math.round(opacity * 0.18) : opacity],
      capRounded: true,
      jointRounded: true,
      parameters: { cullMode: "none", depthWriteEnabled: false },
      updateTriggers: { getPath: [progress, flatWorld], getColor: [progress, colorTheme] },
    }));
  });
}
