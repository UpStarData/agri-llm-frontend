import type {
  EntityCategoryCatalog,
  RelationTypeCatalog,
} from "@/api/relation";

export const relationDomainInfo: Record<
  string,
  { name: string; color: [number, number, number] }
> = {
  production_supply: { name: "生产供应", color: [77, 150, 106] },
  business_org: { name: "经营组织", color: [207, 133, 74] },
  spatial: { name: "空间", color: [84, 123, 170] },
  logistics: { name: "物流", color: [36, 166, 161] },
  policy: { name: "政策", color: [138, 109, 186] },
  impact: { name: "影响", color: [202, 105, 117] },
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
  return [126, 160, 207];
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
