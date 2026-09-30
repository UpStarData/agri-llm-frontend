import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";

export type Mode = "fact" | "relation";
export type MapOverlayType = "ports" | "factSources" | "influence";
export type ColorTheme = "dark" | "light";
export type MapLevel = "world" | "country" | "province";
export type Position = [longitude: number, latitude: number];
export type Selection = { kind: "fact" | "entity" | "relation"; id: string };
export type Boundary = Feature<
  Polygon | MultiPolygon,
  { name: string; regionId: string }
>;
export type Boundaries = FeatureCollection<
  Polygon | MultiPolygon,
  Boundary["properties"]
>;
export interface Source {
  id: string;
  title: string;
  url?: string;
  excerpt: string;
  publishedAt?: string;
}
export interface Fact {
  id: string;
  title: string;
  description?: string;
  content?: string;
  address?: string;
  tags?: string[];
  videoUrl?: string;
  eventTime: string | null;
  regionId: string;
  position: Position | null;
  entityIds: string[];
  sources: Source[];
}
export interface Entity {
  id: string;
  name: string;
  description?: string;
  type: string;
  position: Position | null;
  factIds: string[];
}
export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  description?: string;
  type: string;
  factIds: string[];
}
// 装饰数据独立，不作为统计、详情和关系端点的输入。
export interface VisualParticle {
  id: string;
  anchorFactId: string;
  anchorId: string;
  regionId: string;
  position: Position;
  generatorVersion: string;
  boundaryVersion: string;
}
export interface QueryContext {
  mode: Mode;
  level: MapLevel;
  regionId?: string;
  time: { field: "eventTime"; from: string; to: string };
  filters: { selectedIds: string[] };
  statsScope: "region";
}
export interface MapQueryContext extends QueryContext {
  overlays: MapOverlayType[];
}
export interface MapMarker {
  id: string;
  name: string;
  position: Position;
}
export interface InfluencePoint extends MapMarker {
  intensity?: number;
}
export interface MapData {
  datasetVersion: string;
  facts: Fact[];
  entities: Entity[];
  relations: Relation[];
  overlays?: {
    ports?: MapMarker[];
    factSources?: MapMarker[];
    influence?: InfluencePoint[];
  };
  truncated: boolean;
}
export interface StatsData {
  datasetVersion: string;
  factCount: number;
  entityCount: number;
  relationCount: number;
  updatedAt: string;
  trend: { date: string; count: number }[];
}
export interface NeighborhoodRequest {
  rootEntityId: string;
  depth: 1 | 2;
  direction: "in" | "out" | "both";
  maxNodes: number;
  maxEdges: number;
  context: QueryContext;
  cursor?: string;
}
export interface NeighborhoodData {
  datasetVersion: string;
  nodes: Entity[];
  edges: Relation[];
  truncated: boolean;
  nextCursor?: string;
}
