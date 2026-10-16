import { formatDate } from "./date";
import { commodityNameById } from "./factFilters";
import type { CommodityItem } from "@/api/commodity";
import type { ApiFact } from "@/api/fact";

export interface IFactCard extends ApiFact {
  /** 发生时间 / 地理范围 / 涉及品种，横向拼成一行 */
  commonFields: string;
  /** 核心摘要：最多 3 个非空 typeFields */
  coreFields: { label: string; value: string | number | null }[];
}

/** 事实卡片展示文案在列表处一次算好，渲染循环里只负责摆放。 */
export const factCard = (
  fact: ApiFact,
  commodities?: readonly CommodityItem[],
): IFactCard => {
  const region = fact.geo?.regionPath
    ?.map(({ name }) => name)
    .filter(Boolean)
    .join(" › ");
  const varieties = fact.commodityIds
    ?.map((id) => commodityNameById(id, commodities))
    .filter(Boolean)
    .join("、");
  return {
    ...fact,
    commonFields: [
      fact.occurredAt ? formatDate(fact.occurredAt) : "",
      region,
      varieties,
    ]
      .filter(Boolean)
      .join(" / "),
    coreFields:
      fact.typeFields
        ?.filter(({ value }) => value != null && String(value).trim() !== "")
        .slice(0, 3)
        .map(({ label, value }) => ({ label: label?.trim() ?? "", value })) ?? [],
  };
};
