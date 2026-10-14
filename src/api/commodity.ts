import { request } from "./request";

export interface ApiResponse<T> { data: T }
export interface CommodityItem {
  /** 品种 ID（UUID v7，与 fact.commodityIds / relation 入参同源）。 */
  id: string;
  /** 品种中文名（品种筛选下拉展示名）。 */
  name: string;
  status: string
}

// 品种主数据平铺列表（请求期查库装配，后台增删品种即时生效）
export const getCommodities = () =>
  request<ApiResponse<{ items: CommodityItem[] }>>({
    url: `/commodities`,
    method: "GET",
    errorPresentation: "local",
  });
