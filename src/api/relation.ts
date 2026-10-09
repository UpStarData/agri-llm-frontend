import { request } from "./request";
import type { ApiResponse } from "./fact";
import type { Entity, Relation } from "../types";
import type { FactView } from "./fact";

export interface EntityCategoryCatalog {
  version: string;
  categories: {
    key: string;
    name: string;
    children: { key: string; name: string; displayGroup: string }[];
  }[];
}
export interface RelationTypeCatalog {
  version: string;
  types: {
    key: string;
    name: string;
    colorDomain: string;
    directed: boolean;
    sourceL2s: string[];
    targetL2s: string[];
  }[];
}

export interface RelationFilters {
  categories: string[];
  commodityIds: string[];
  q?: string;
}
export interface EntityPage {
  items: EntityListItem[];
  hasMore: boolean;
  page: number;
  total: number;
  pageSize: number;
}
export interface EntityListItem {
  entityId: string;
  canonicalName: string;
  category: { l1?: string; l2?: string; displayGroup: string };
  geo?: {
    regionPath?: { code?: string; name: string; level?: string }[];
    geoPoint?: [number, number] | null;
    geoPrecision?: string;
    viewLevels?: string[];
  };
  commodityIds?: string[];
  typeFields?: { label: string; value: string | number }[];
  summary?: string;
  relationCount?: number;
  evidenceStatus?: "multi_source" | "single_source" | "pending" | "conflict";
  sourceType?: string;
  updatedAt?: string;
}
export interface RelationCount {
  entityTotal: number;
  todayNewEntities: number;
  todayNewRelations: number;
}
export interface RelationContext {
  factId?: string;
  factTitle?: string;
  rootEntityId?: string;
  rootEntityName?: string;
}
export interface RelationGraph {
  entities: Entity[];
  relations: Relation[];
  total: number;
  returned: number;
  truncated: boolean;
}
export interface GraphRequest {
  limit?: number;
  categoryKeys?: string[];
  commodityIds?: string[];
  relationTypes?: string[];
  evidenceStatus?: "multi_source" | "single_source" | "pending" | "conflict";
  sourceType?: "fact" | "preset";
  coldStart?: boolean;
  q?: string;
}
export interface GraphPointsRequest extends GraphRequest {
  view: FactView;
}
export interface GraphNode {
  entityId: string;
  canonicalName: string;
  categoryL2: string;
  displayGroup: string | null;
  geoPoint: [number, number] | null;
  viewLevels: FactView[];
}
export interface GraphEdge {
  relationId: string;
  typeKey: string;
  colorDomain: string;
  directed: boolean;
  sourceEntityId: string;
  targetEntityId: string;
  displayLevels: FactView[];
  supportFactCount: number;
  involvedVarieties: string[];
}
export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total: number;
  returned: number;
  truncated: boolean;
}
export interface GraphEnvelope extends ApiResponse<GraphResponse> {
  code: number;
  message: string;
}

export interface RelationProcessingEvent {
  id: string;
  occurredAt: string;
  message: string;
  entityIds?: string[];
  relationIds?: string[];
}

// 本体分类筛选
export const getEntityCategories = () =>
  request<ApiResponse<EntityCategoryCatalog>>({
    url: "/entity-categories",
    method: "GET",
    errorPresentation: "local",
  });

// 关系筛选
export const getRelationTypes = () =>
  request<ApiResponse<RelationTypeCatalog>>({
    url: "/relation-types",
    method: "GET",
    errorPresentation: "local",
  });

// 右侧卡片列表
export const getEntities = (
  data: RelationFilters & { page: number; pageSize: number },
) =>
  request<ApiResponse<EntityPage>>({
    url: "/entities",
    method: "POST",
    data,
    errorPresentation: "local",
  });

// 数据概览
export const getRelationCount = () =>
  request<ApiResponse<RelationCount>>({
    url: "/entities/stats",
    method: "GET",
    errorPresentation: "local",
  });

export interface RelationDetailResponse {
  relationId: string;
  overview: {
    source: { entityId: string; canonicalName: string; categoryL2: string };
    typeKey: string;
    name?: string;
    target: { entityId: string; canonicalName: string; categoryL2: string };
  };
  directed?: boolean;
  colorDomain?: string;
  typeFields?: { label: string; value: string | number | null }[];
  evidenceStatus?: string;
  sourceType?: "fact" | "preset";
  supportFacts?:
    { factId: string; title: string; basis?: string | null }[] | null;
  formation?: { firstWrittenAt?: string; lastUpdatedAt?: string } | null;
}

export const getRelation = (id: string) =>
  request<ApiResponse<RelationDetailResponse>>({
    url: `/relations/${encodeURIComponent(id)}`,
    method: "GET",
    errorPresentation: "local",
  });

export const getRelationGraph = (data: GraphRequest) =>
  request<GraphEnvelope>({
    url: "/graph",
    method: "POST",
    data,
    errorPresentation: "local",
  });

export const getRelationGraphPoints = (data: GraphPointsRequest) =>
  request<GraphEnvelope>({
    url: "/graph/points",
    method: "POST",
    data,
    errorPresentation: "local",
  });

export const getEntity = (id: string) =>
  request<ApiResponse<Entity>>({
    url: `/entities/${encodeURIComponent(id)}`,
    method: "GET",
    errorPresentation: "local",
  });
