import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  getEntities,
  getEntity,
  getRelation,
  getRelationCount,
  getRelationGraph,
  getRelationGraphPoints,
  getEntityCategories,
  getRelationTypes,
} from "@/api/relation";
import type {
  EntityCategoryCatalog,
  GraphEnvelope,
  RelationGraph,
  RelationTypeCatalog,
} from "@/api/relation";
import { ApiError } from "@/api/request";
import type { FactView } from "@/api/fact";
import { useDashboardStore } from "@/store";

const ENTITY_PAGE_SIZE = 30;

export const relationGraphForView = (response: GraphEnvelope): RelationGraph => {
  if (response.code !== 0 || !response.data)
    throw new ApiError(response.message || "图谱数据请求失败");
  const { nodes, edges, total, returned, truncated } = response.data;
  return {
    entities: nodes.map((node) => ({
      id: node.entityId,
      name: node.canonicalName,
      type: node.categoryId,
      displayGroup: node.displayGroup ?? undefined,
      position: node.geoPoint,
      viewLevels: node.viewLevels,
      factIds: [],
    })),
    relations: edges.map((edge) => ({
      id: edge.relationId,
      type: edge.typeId,
      sourceId: edge.sourceEntityId,
      targetId: edge.targetEntityId,
      displayLevels: edge.displayLevels,
      supportFactCount: edge.supportFactCount,
      colorDomain: edge.colorDomain,
      directed: edge.directed,
      involved_varieties: edge.involvedVarieties,
      factIds: [],
    })),
    total,
    returned,
    truncated,
  };
};

export const useRelationCatalogs = () => {
  const active = useDashboardStore((s) => s.mode === "relation");
  const categories = useQuery({
    queryKey: ["relation", "entity-categories"],
    queryFn: async () => (await getEntityCategories()).data,
    enabled: active,
    staleTime: 0,
    refetchOnReconnect: false,
    meta: { notifyOnError: true },
  });
  const types = useQuery({
    queryKey: ["relation", "relation-types"],
    queryFn: async () => (await getRelationTypes()).data,
    enabled: active,
    staleTime: 0,
    refetchOnReconnect: false,
    meta: { notifyOnError: true },
  });
  return { categories, types };
};

export const useRelationQueries = (
  categories?: EntityCategoryCatalog,
  types?: RelationTypeCatalog,
) => {
  const { mode, varieties, excluded, excludedTypes, keyword, revision, level, regionId, crossRegion } =
    useDashboardStore(
      useShallow((s) => ({
        mode: s.mode,
        varieties: s.factFilters.varieties,
        excluded: s.excludedFilterIds.relation,
        excludedTypes: s.relationFilters.excludedTypes,
        keyword: s.relationFilters.keyword,
        revision: s.relationRevision,
        level: s.level,
        regionId: s.regionId,
        crossRegion: s.relationFilters.crossRegion,
      })),
    );

  const active = mode === "relation";
  const commodityIds = varieties;

  const filters = {
    categoryIds: (
      categories?.categories.flatMap((group) =>
        group.children.map((child) => child.id),
      ) ?? []
    ).filter((id) => !excluded.includes(id)),
    commodityIds,
    relationTypeIds: (types?.types ?? [])
      .map((type) => type.id)
      .filter((id) => !excludedTypes.includes(id)),
    q: keyword || undefined,
  };

  const graphRequest = filters;
  const enabled = active && Boolean(categories) && Boolean(types);
  const view: FactView =
    level === "province" && regionId === "430000"
      ? "hunan"
      : level === "world" || (level === "country" && regionId !== "CN")
        ? "global"
        : "china";

  const graph = useQuery({
    queryKey: ["relation", "graph", graphRequest, revision],
    queryFn: async () => relationGraphForView(await getRelationGraph(graphRequest)),
    enabled,
    staleTime: 0,
    meta: { notifyOnError: true },
  });

  const map = useQuery({
    queryKey: ["relation", "graph-points", view, crossRegion, graphRequest, revision],
    queryFn: async () =>
      relationGraphForView(await getRelationGraphPoints({
        ...graphRequest,
        view,
        includeCrossRegion: crossRegion,
      })),
    enabled,
    staleTime: 0,
    meta: { notifyOnError: true },
  });

  const list = useInfiniteQuery({
    queryKey: ["relation", "list", filters, revision],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getEntities({
        ...filters,
        page: pageParam,
        pageSize: ENTITY_PAGE_SIZE,
      });
      if ((response.code !== undefined && response.code !== 0) || !response.data)
        throw new ApiError(response.message || "本体列表请求失败");
      return { ...response.data, items: response.data.items || [] };
    },
    getNextPageParam: (page, pages) => {
      const loaded = pages.reduce((count, current) => count + current.items.length, 0);
      return page.items.length > 0 && loaded < page.total
        ? page.page + 1
        : undefined;
    },
    enabled,
    staleTime: 0,
    meta: { notifyOnError: true },
  });

  const count = useQuery({
    queryKey: ["relation", "count"],
    queryFn: async () => (await getRelationCount()).data,
    enabled: active,
    meta: { notifyOnError: true },
  });

  return {
    graph,
    map,
    list,
    listScope: JSON.stringify([filters, revision]),
    count,
  };
};

export const useEntityDetail = (id?: string) =>
  useQuery({
    queryKey: ["relation", "entity", id],
    queryFn: async () => (await getEntity(id!)).data,
    enabled: Boolean(id),
    meta: { notifyOnError: true },
  });

export const useRelationDetail = (id?: string) =>
  useQuery({
    queryKey: ["relation", "detail", id],
    queryFn: async () => {
      const detail = (await getRelation(id!)).data;
      if (!detail) throw new ApiError("关系详情为空");
      return detail;
    },
    enabled: Boolean(id),
    meta: { notifyOnError: true },
  });
