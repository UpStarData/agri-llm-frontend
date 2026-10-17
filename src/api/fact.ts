import { request } from "./request";

export interface ApiResponse<T> { data: T }
export interface FactCount { total?: number; todayAdded?: number }
export interface FactTaxonomyGroup {
  /** 分类节点 ID（UUID v7，任意层级），事实分类筛选的取值来源 */
  id: string;
  name: string;
  categories: { id: string; name: string; types: { id: string; name: string; emoji: string }[] }[];
}
export interface FactTaxonomy { groups: FactTaxonomyGroup[] }
export type DetailTypeField = (
  | { label: string; labe?: string }
  | { label?: string; labe: string }
) & { value: string | number | null };
export interface ApiFact {
  factId: string;
  title: string;
  summary: string;
  keyMetrics?: string;
  typeFields?: DetailTypeField[] | null;
  /** F3 三级分类叶子节点 UUID v7；null=未分类。 */
  categoryId?: string | null;
  /** 分类中文名（后端随 categoryId 下发）；null=未分类。 */
  categoryName?: string | null;
  occurredAt?: string;
  geo?: { regionPath?: { code?: string; name: string; level?: string }[]; geoPoint?: [number, number] | null };
  commodityIds?: string[];
  /** 图片地址列表；null/缺省表示无图。 */
  imageArr?: string[] | null;
  /** 视频地址列表；null/缺省表示无视频。 */
  videoArr?: string[] | null;
  entityCandidates?: { name: string }[];
  evidenceCount?: number;
  evidenceStatus?: string;
  dataMode?: string;
  createdAt?: string;
  fullCategoryName?: string
}
export interface FactPage { items: ApiFact[]; total: number }
export interface FactPoint {
  /** 接口返回的分类节点，用分类树查所属大类颜色。 */
  categoryId?: string | null;
  categoryName?: string | null;
  /** 时间切换时的热度序列：倒序播放，整轮 3.2 秒先快后慢，最终与 intensity 一致。 */
  intensityArr?: number[];
  /** 热度/时效性，0–100；越低越透明，零值保留最低可见度，缺省时完全不透明。 */
  intensity?: number;
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
  description?: string | null;
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
  /** F3 分类筛选：任意层级节点 UUID v7（一级/二级/叶子均可），服务端展开子树。 */
  CategoryIds?: readonly string[];
  City?: string;
  /** 品种筛选：UUID v7 品种 ID 数组，多选 OR。 */
  CommodityIds?: readonly string[];
  EntityId?: string;
  EvidenceStatus?: EvidenceStatus;
  Fields?: Fields;
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
  The180D = "180d",
  The365D = "365d",
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
