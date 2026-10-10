import { request } from "./request";

export interface ApiResponse<T> { data: T }
export interface FactCount { total?: number; todayAdded?: number }
export interface FactTaxonomyGroup {
  key: string;
  name: string;
  categories: { name: string; types: { key: string; name: string; emoji: string }[] }[];
}
export interface FactTaxonomy { groups: FactTaxonomyGroup[] }
export interface Commodity { id: string; name: string }
export interface ApiFact {
  factId: string;
  title: string;
  summary: string;
  keyMetrics?: string;
  categoryName?: string;
  occurredAt?: string;
  geo?: { regionPath?: { code?: string; name: string; level?: string }[]; geoPoint?: [number, number] | null };
  commodityIds?: string[];
  entityCandidates?: { name: string }[];
  evidenceCount?: number;
  evidenceStatus?: string;
  dataMode?: string;
  createdAt?: string;
  fullCategoryName?: string
}
export interface FactPage { items: ApiFact[]; total: number }
export interface FactPoint {
  impactRadiusKm?: number | null;
  factId: string;
  geoPoint: [number, number];
  title?: string;
  occurredAt?: string;
  regionPath?: { name: string }[];
  address?: string;
}
export type FactView = "global" | "china" | "hunan";
export interface FactDetail { fact: ApiFact; entities: unknown[]; evidence: unknown[] }
export interface GeoPoint {
  pointId: string;
  name: string;
  kind: GeoPointKind;
  geoPoint: [number, number];
}

// 产区、港口、机场、农贸市场、地缘风险。
export type GeoPointKind = "region" | "port" | "airport" | "market" | "risk";

export interface GeoPointsRequest {
  view: FactView;
  /** 不传时由服务端返回全部类型；多个类型按逗号分隔发送。 */
  kinds?: readonly [GeoPointKind, ...GeoPointKind[]];
}

export interface FactRequest {
  /** 地图视角：未指定时服务端默认 global。 */
  view?: FactView;
  /** 增量游标（ISO 8601，createdAt 口径），与 Page 互斥。 */
  After?: string;
  CardTypes?: CardTypes | readonly [CardTypes, ...CardTypes[]];
  City?: string;
  CommodityId?: string[];
  DataMode?: DataMode;
  EntityId?: string;
  EvidenceStatus?: EvidenceStatus;
  Fields?: Fields;
  LeafKeys?: readonly string[];
  Page?: number;
  PageSize?: number;
  Province?: string;
  Q?: string;
  TimeRange?: TimeRange;
}

/**
 * 卡片模板类型，逗号分隔
 */
export enum CardTypes {
  Market = "market",
  News = "news",
  Policy = "policy",
  Price = "price",
  Video = "video",
  Weather = "weather",
}

/**
 * 数据状态
 */
export enum DataMode {
  Desensitized = "desensitized",
  Real = "real",
  Simulated = "simulated",
}

/**
 * 证据状态
 */
export enum EvidenceStatus {
  Conflict = "conflict",
  MultiSource = "multi_source",
  Pending = "pending",
  SingleSource = "single_source",
}

/**
 * 投影：list（默认，瘦身）/ full（追加溯源时间与处理版本）
 */
export enum Fields {
  Full = "full",
  List = "list",
}

/**
 * 时间范围，默认 7d（today=发生时间当日；all 仅调试/全量）
 */
export enum TimeRange {
  All = "all",
  The30D = "30d",
  The7D = "7d",
  Today = "today",
}

// 左侧弹窗三级分类树
export const getFactTaxonomy = () =>
  request<ApiResponse<FactTaxonomy>>({
    url: `/dictionaries/fact-taxonomy`,
    method: "GET",
    errorPresentation: "local",
  });

// 左侧弹窗顶部事件总数和今日新增计数
export const getFactCount = () =>
  request<ApiResponse<FactCount>>({
    url: `/facts/count`,
    method: "GET",
    errorPresentation: "local",
  });

const serializeFactRequest = (params: FactRequest) =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key[0].toLowerCase() + key.slice(1),
        key === "CardTypes" && Array.isArray(value) ? value.join(",") : value,
      ]),
  );

// 事实右侧弹窗卡片流列表
export const getFacts = async (params: FactRequest = {}) => {
  if (params.After !== undefined && params.Page !== undefined) {
    throw new Error("After 与 Page 不能同时使用");
  }
  return request<ApiResponse<FactPage>>({
    url: `/facts`,
    method: "POST",
    data: serializeFactRequest(params),
    errorPresentation: "local",
  });
};

// 事实右侧弹窗详情
export const getFactDetail = (factId: string) =>
  request<ApiResponse<FactDetail>>({
    url: `/facts/${encodeURIComponent(factId)}`,
    method: "GET",
    errorPresentation: "local",
  });

// 地图星点
export const getFactPoints = (params: FactRequest = {}) =>
  request<ApiResponse<{ items: FactPoint[] }>>({
    url: `/facts/points`,
    method: "POST",
    data: serializeFactRequest(params),
    errorPresentation: "local",
  });

// 叠加图层点位（产区/港口/机场/农贸市场/地缘风险）
export const getGeoPoints = (
  { kinds, view }: GeoPointsRequest,
) =>
  request<ApiResponse<{ items: GeoPoint[] }>>({
    url: `/geo-points`,
    method: "GET",
    params: { view, ...(kinds && { kinds: kinds.join(",") }) },
    errorPresentation: "local",
  });

// 品种主数据
export const getCommodities = () =>
  request<ApiResponse<{ items: Commodity[] }>>({
    url: `/commodities`,
    method: "GET",
    errorPresentation: "local",
  });
