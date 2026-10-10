import type { Entity, Relation } from "@/types";
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
    (item) => item.key === type,
  )?.colorDomain;
  if (domain && relationDomainInfo[domain])
    return relationDomainInfo[domain].color;
  return [126, 160, 207];
};
export const relationTypeInfo = (type: string, catalog?: RelationTypeCatalog) =>
  catalog?.types.find((item) => item.key === type);
export const entityCategoryName = (
  type: string,
  catalog?: EntityCategoryCatalog,
) =>
  catalog?.categories
    .flatMap((group) => group.children)
    .find((item) => item.key === type || item.name === type)?.name ?? type;
export const filterRelationGraph = (
  entities: Entity[],
  relations: Relation[],
  excludedCategories: string[],
  excludedRelations: string[],
  varieties: string[],
  keyword = "",
  categories?: EntityCategoryCatalog,
) => {
  const excludedCategoryNames = new Set(excludedCategories);
  categories?.categories.forEach((group) =>
    group.children.forEach((child) => {
      if (excludedCategories.includes(child.key))
        excludedCategoryNames.add(child.name);
    }),
  );
  const excludedRelationNames = new Set(excludedRelations);
  // 品种依据关系预存 involved_varieties，禁止在前端推断多跳关联。
  const varietyRelations = relations.filter(
    (r) =>
      !varieties.length ||
      r.involved_varieties?.some((id) => varieties.includes(id)),
  );
  const varietyEntities = new Set(
    varietyRelations.flatMap((r) => [r.sourceId, r.targetId]),
  );
  const nodes = entities.filter(
    (e) =>
      !excludedCategoryNames.has(e.type) &&
      (!varieties.length ||
        varietyEntities.has(e.id) ||
        varieties.includes(e.id)) &&
      (!keyword ||
        e.name.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())),
  );
  const ids = new Set(nodes.map(({ id }) => id));
  const edges = varietyRelations.filter(
    (r) =>
      !excludedRelationNames.has(r.type) &&
      ids.has(r.sourceId) &&
      ids.has(r.targetId),
  );
  return { entities: nodes, relations: edges };
};
