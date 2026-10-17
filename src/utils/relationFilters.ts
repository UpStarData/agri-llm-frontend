import { ECOLOGY_THEME, rgb } from "./ecologyTheme";
import type {
  EntityCategoryCatalog,
  RelationTypeCatalog,
} from "@/api/relation";

export const relationDomainInfo: Record<
  string,
  { name: string; color: [number, number, number] }
> = {
  production_supply: { name: "生产供应", color: rgb(ECOLOGY_THEME.categoryProduction) },
  business_org: { name: "经营组织", color: rgb(ECOLOGY_THEME.categoryMarket) },
  spatial: { name: "空间", color: rgb(ECOLOGY_THEME.categoryNature) },
  logistics: { name: "物流", color: rgb(ECOLOGY_THEME.categoryLogistics) },
  policy: { name: "政策", color: rgb(ECOLOGY_THEME.categoryPolicy) },
  impact: { name: "影响", color: rgb(ECOLOGY_THEME.categoryEvent) },
};
export const relationColor = (
  type: string,
  catalog?: RelationTypeCatalog,
  colorDomain?: string,
): [number, number, number] => {
  const domain = colorDomain ?? catalog?.types.find(
    (item) => item.id === type,
  )?.colorDomain;
  if (domain && relationDomainInfo[domain])
    return relationDomainInfo[domain].color;
  return rgb(ECOLOGY_THEME.factPoint);
};
export const relationTypeInfo = (type: string, catalog?: RelationTypeCatalog) =>
  catalog?.types.find((item) => item.id === type);
export const entityCategoryName = (
  type: string,
  catalog?: EntityCategoryCatalog,
) =>
  catalog?.categories
    .flatMap((group) => group.children)
    .find((item) => item.id === type)?.name ?? type;
