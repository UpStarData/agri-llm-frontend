import { GeoJsonLayer, PathLayer, LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { FactPoint } from "../api/fact";
import { impactCircle } from "./impact";
import { flattenWorldPosition } from "./map";
import type {
  Boundaries,
  ColorTheme,
  Entity,
  MapData,
  MapMarker,
  MapOverlayType,
  Mode,
  Selection,
  VisualParticle,
  Position,
} from "../types";

const EMPTY: MapData = {
  datasetVersion: "",
  facts: [],
  entities: [],
  relations: [],
  truncated: false,
};
const MAP_COLORS: Record<ColorTheme, {
  worldFill: [number, number, number]; worldLine: [number, number, number];
  chinaFill: [number, number, number]; chinaSelected: [number, number, number]; chinaLine: [number, number, number];
  fact: [number, number, number]; relation: [number, number, number, number]; entity: [number, number, number];
}> = {
  dark: { worldFill: [17, 59, 65], worldLine: [77, 118, 122], chinaFill: [23, 72, 78], chinaSelected: [33, 108, 108], chinaLine: [97, 160, 157], fact: [108, 221, 205], relation: [221, 174, 99, 150], entity: [239, 185, 102] },
  light: { worldFill: [224, 240, 238], worldLine: [129, 166, 165], chinaFill: [194, 225, 220], chinaSelected: [115, 190, 177], chinaLine: [93, 159, 150], fact: [24, 137, 126], relation: [192, 125, 36, 170], entity: [190, 117, 31] },
};
export function createParticleLayer(particles: VisualParticle[]) {
  return new ScatterplotLayer<VisualParticle>({
    id: "visual-particles",
    data: particles,
    pickable: false,
    getPosition: (d) => d.position,
    getRadius: 1,
    radiusUnits: "pixels",
    getFillColor: [89, 178, 179, 70],
  });
}
export function createMapLayers({
  world,
  china,
  points = [],
  regionId,
  level,
  mode,
  colorTheme,
  data = EMPTY,
  overlayVisibility = { ports: false, factSources: false, influence: false },
  influencePhase = 0,
  select,
  selectCountry,
  selectProvince,
  flatWorld = false,
}: {
  world?: Boundaries;
  china?: Boundaries;
  points?: FactPoint[];
  regionId?: string;
  level: string;
  mode: Mode;
  colorTheme: ColorTheme;
  data?: MapData;
  overlayVisibility?: Record<MapOverlayType, boolean>;
  influencePhase?: number;
  select: (selection: Selection) => void;
  selectCountry?: (id: string) => void;
  selectProvince: (id: string) => void;
  flatWorld?: boolean;
}): Layer[] {
  const position = (point: Position): Position => flatWorld ? flattenWorldPosition(point) : point;
  const colors = MAP_COLORS[colorTheme];
  const ports = data.overlays?.ports ?? [];
  const factSources = data.overlays?.factSources ?? [];
  const influence = points.filter((point) => Number.isFinite(point.impactRadiusKm) && point.impactRadiusKm! > 0);
  const entities = new Map(data.entities.map((entity) => [entity.id, entity]));
  const edges = data.relations.flatMap((relation) => {
    const from = entities.get(relation.sourceId)?.position;
    const to = entities.get(relation.targetId)?.position;
    return from && to ? [{ ...relation, from: position(from), to: position(to) }] : [];
  });
  return [
    new GeoJsonLayer({
      id: "world-boundaries",
      data: world,
      pickable: true,
      autoHighlight: true,
      highlightColor: [92, 210, 200, 115],
      filled: true,
      stroked: true,
      getFillColor: (f) => level === "country" && f.properties?.regionId === regionId
        ? colors.chinaSelected : colors.worldFill,
      getLineColor: colors.worldLine,
      lineWidthMinPixels: 0.5,
      updateTriggers: { getFillColor: [level, regionId, colorTheme] },
      onClick: ({ object }) => {
        if (object?.properties?.regionId)
          selectCountry?.(object.properties.regionId);
      },
    }),
    new GeoJsonLayer({
      id: "china-boundaries",
      data: china,
      visible: level === "province" || (level === "country" && regionId === "CN"),
      pickable: true,
      autoHighlight: true,
      highlightColor: [92, 210, 200, 115],
      filled: true,
      stroked: true,
      getFillColor: (f) =>
        f.properties?.regionId === regionId ? colors.chinaSelected : colors.chinaFill,
      getLineColor: colors.chinaLine,
      lineWidthMinPixels: 0.7,
      updateTriggers: { getFillColor: [regionId, colorTheme] },
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
      radiusUnits: "pixels",
      getFillColor: colors.fact,
      onClick: ({ object }) => {
        if (object) select({ kind: "fact", id: object.factId });
      },
    }),
    new LineLayer({
      id: "real-relations",
      data: edges,
      visible: mode === "relation",
      pickable: true,
      getSourcePosition: (d) => d.from,
      getTargetPosition: (d) => d.to,
      getColor: colors.relation,
      getWidth: 2,
      onClick: ({ object }) => {
        if (object) select({ kind: "relation", id: object.id });
      },
    }),
    new ScatterplotLayer<Entity>({
      id: "real-entities",
      data: data.entities.filter((e) => e.position !== null),
      visible: mode === "relation",
      pickable: true,
      getPosition: (d) => position(d.position!),
      getRadius: 6,
      radiusUnits: "pixels",
      getFillColor: colors.entity,
      onClick: ({ object }) => {
        if (object) select({ kind: "entity", id: object.id });
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
      getFillColor: [81, 175, 230, 220],
      getLineColor: [235, 249, 255, 245],
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1,
    }),
    ...(mode === "fact" && overlayVisibility.ports && ports.length ? [new TextLayer<MapMarker>({
      id: "overlay-port-labels",
      data: ports,
      visible: mode === "fact" && overlayVisibility.ports,
      pickable: false,
      getPosition: (d) => position(d.position),
      getText: (d) => d.name,
      characterSet: "auto",
      fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      getSize: 12,
      sizeUnits: "pixels",
      getPixelOffset: [0, 17],
      getTextAnchor: "middle",
      getColor: colorTheme === "dark" ? [226, 241, 247] : [29, 76, 96],
    })] : []),
    new ScatterplotLayer<MapMarker>({
      id: "overlay-fact-sources",
      data: factSources,
      visible: mode === "fact" && overlayVisibility.factSources,
      pickable: true,
      getPosition: (d) => position(d.position),
      getRadius: 6,
      radiusUnits: "pixels",
      getFillColor: [245, 171, 91, 220],
    }),
    ...(mode === "fact" && overlayVisibility.factSources && factSources.length ? [new TextLayer<MapMarker>({
      id: "overlay-source-labels",
      data: factSources,
      visible: mode === "fact" && overlayVisibility.factSources,
      pickable: false,
      getPosition: (d) => position(d.position),
      getText: (d) => d.name,
      characterSet: "auto",
      fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      getSize: 11,
      sizeUnits: "pixels",
      getPixelOffset: [0, 16],
      getTextAnchor: "middle",
      getColor: colorTheme === "dark" ? [255, 219, 176] : [138, 75, 29],
    })] : []),
    ...[0, 1, 2, 3].map((index) => {
      const progress = index === 3 ? 1 : (influencePhase + index / 3) % 1;
      return new PathLayer<FactPoint>({
        id: `overlay-influence-ring-${index}`,
        data: influence,
        visible: mode === "fact" && overlayVisibility.influence,
        pickable: false,
        getPath: (point) => impactCircle(point.geoPoint, point.impactRadiusKm! * progress).map(position),
        wrapLongitude: true,
        widthUnits: "pixels",
        getWidth: index === 3 ? 1 : 2,
        getColor: [255, 157, 86, index === 3 ? 95 : Math.round((1 - progress) * 190)],
        parameters: { cullMode: "none" },
        updateTriggers: { getPath: [progress, flatWorld], getColor: progress },
      });
    }),
  ];
}
