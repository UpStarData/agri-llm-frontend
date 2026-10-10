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
      type: node.categoryL2,
      displayGroup: node.displayGroup ?? undefined,
      position: node.geoPoint,
      viewLevels: node.viewLevels,
      factIds: [],
    })),
    relations: edges.map((edge) => ({
      id: edge.relationId,
      type: edge.typeKey,
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

export const useRelationQueries = (categories?: EntityCategoryCatalog) => {
  const { mode, varieties, excluded, keyword, revision, level, regionId } =
    useDashboardStore(
      useShallow((s) => ({
        mode: s.mode,
        varieties: s.factFilters.varieties,
        excluded: s.excludedFilterIds.relation,
        keyword: s.relationFilters.keyword,
        revision: s.relationRevision,
        level: s.level,
        regionId: s.regionId,
      })),
    );

  const active = mode === "relation";
  const commodityIds = varieties;

  const filters = {
    categories: (
      categories?.categories.flatMap((group) =>
        group.children.map((child) => child.key),
      ) ?? []
    ).filter((id) => !excluded.includes(id)),
    commodityIds,
    q: keyword || undefined,
  };

  const graphRequest = {
    commodityIds,
  };
  const view: FactView =
    level === "province" && regionId === "430000"
      ? "hunan"
      : level === "world" || (level === "country" && regionId !== "CN")
        ? "global"
        : "china";

  const graph = useQuery({
    queryKey: ["relation", "graph", graphRequest, revision],
    queryFn: async () => relationGraphForView(await getRelationGraph(graphRequest)),
    enabled: active,
    staleTime: Infinity,
    meta: { notifyOnError: true },
  });

  const map = useQuery({
    queryKey: ["relation", "graph-points", view, graphRequest, revision],
    queryFn: async () =>
      relationGraphForView(await getRelationGraphPoints({ ...graphRequest, view })),
    enabled: active,
    staleTime: Infinity,
    meta: { notifyOnError: true },
  });

  const list = useInfiniteQuery({
    queryKey: ["relation", "list", filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getEntities({
        ...filters,
        page: pageParam,
        pageSize: ENTITY_PAGE_SIZE,
      });
      return { ...response.data, items: response.data.items || [] };
    },
    getNextPageParam: (page, pages) => {
      const loaded = pages.reduce((count, current) => count + current.items.length, 0);
      return page.items.length > 0 && loaded < page.total
        ? page.page + 1
        : undefined;
    },
    enabled: active && Boolean(categories) && filters.categories.length > 0,
    staleTime: Infinity,
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
    count,
    commodityIds,
    noCategories: Boolean(categories) && filters.categories.length === 0,
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
