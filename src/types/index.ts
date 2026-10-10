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
export interface EvidenceFact {
  factId: string;
  title: string;
  excerpt?: string;
}
export interface Entity {
  displayGroup?: string;
  id: string;
  name: string;
  description?: string;
  type: string;
  position: Position | null;
  viewLevels?: ("global" | "china" | "hunan")[];
  factIds: string[];
  address?: string;
  regionPath?: { code: string; name: string; level: string }[];
  commodityIds?: string[];
  attributes?: Record<string, string | number>;
  relationCount?: number;
  relations?: Relation[];
  evidenceStatus?: string;
  sourceType?: "fact" | "preset";
  evidence?: EvidenceFact[];
  createdAt?: string;
  updatedAt?: string;
}
export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  description?: string;
  type: string;
  factIds: string[];
  displayLevels?: ("global" | "china" | "hunan")[];
  supportFactCount?: number;
  colorDomain?: string;
  directed?: boolean;
  involved_varieties?: string[];
  scopeLayer?: "global" | "china" | "hunan";
  evidenceStatus?: string;
  sourceType?: "fact" | "preset";
  evidence?: EvidenceFact[];
  basis?: string;
  attributes?: Record<string, string | number>;
  source?: Pick<Entity, "id" | "name" | "type">;
  target?: Pick<Entity, "id" | "name" | "type">;
  createdAt?: string;
  updatedAt?: string;
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
