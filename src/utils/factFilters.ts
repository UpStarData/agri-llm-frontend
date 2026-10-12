import type { ApiFact, FactTaxonomyGroup } from "@/api/fact";
import type { CommodityItem } from "@/api/commodity";

const provinceSuffixes: Record<string, string> = {
  "11": "BJ", "12": "TJ", "13": "HE", "14": "SX", "15": "NM",
  "21": "LN", "22": "JL", "23": "HL", "31": "SH", "32": "JS",
  "33": "ZJ", "34": "AH", "35": "FJ", "36": "JX", "37": "SD",
  "41": "HA", "42": "HB", "43": "HN", "44": "GD", "45": "GX",
  "46": "HI", "50": "CQ", "51": "SC", "52": "GZ", "53": "YN",
  "54": "XZ", "61": "SN", "62": "GS", "63": "QH", "64": "NX",
  "65": "XJ", "71": "TW", "81": "HK", "82": "MO",
};

export const commodityNameById = (id: string, commodities: readonly CommodityItem[] = []) =>
  commodities.find((commodity) => commodity.id === id)?.name ?? id;

export const evidenceStatusLabels: Record<string, string> = {
  single_source: "单一来源",
  multi_source: "多来源支持",
  pending: "待补证",
  conflict: "存在冲突",
};

export const provinceApiCode = (provinceId: string) => {
  const suffix = provinceSuffixes[provinceId.slice(0, 2)];
  return suffix ? `CN-${suffix}` : undefined;
};

export const matchesFactFilters = (
  fact: ApiFact,
  countryId: string,
  provinceId: string,
) => {
  const path = fact.geo?.regionPath ?? [];
  if (countryId === "CN" && !path.some((part) => part.code === "CHN" || part.code === "CN")) return false;
  if (provinceId) {
    const code = provinceApiCode(provinceId);
    if (!code || !path.some((part) => part.code === code)) return false;
  }
  return true;
};

/**
 * 压缩事实层分类筛选入参：一级/二级下的三级类型全保留时直接传层级节点 ID
 * （契约 A-27：服务端按节点深度展开子树），仅部分保留时下钻到叶子 id。
 */
export const compactCategoryIds = (
  groups: readonly FactTaxonomyGroup[],
  excluded: readonly string[],
): string[] => {
  const excludedIds = new Set(excluded);
  const ids: string[] = [];
  for (const group of groups) {
    const types = group.categories.flatMap((category) => category.types);
    if (types.length > 0 && types.every((type) => !excludedIds.has(type.id))) {
      ids.push(group.id);
      continue;
    }
    for (const category of group.categories) {
      if (category.types.length === 0) continue;
      if (category.types.every((type) => !excludedIds.has(type.id))) {
        ids.push(category.id);
      } else {
        for (const type of category.types) {
          if (!excludedIds.has(type.id)) ids.push(type.id);
        }
      }
    }
  }
  return ids;
};
