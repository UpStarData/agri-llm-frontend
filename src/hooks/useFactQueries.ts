import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFactDetail,
  getFactPoints,
  getFactTaxonomy,
  getFacts,
  getGeoPoints,
} from "@/api/fact";
import type { FactPage, FactRequest, GeoPointsRequest } from "@/api/fact";
import { useDashboardStore } from "@/store";
import { notifyRequestError } from "@/api/request";
import { matchesFactFilters } from "@/utils/factFilters";

const FACT_PAGE_SIZE = 30;

export function useFactTaxonomy() {
  const mode = useDashboardStore((s) => s.mode);
  return useQuery({
    queryKey: ["fact", "taxonomy"],
    queryFn: async () => (await getFactTaxonomy()).data,
    enabled: mode === "fact",
    staleTime: 10 * 60_000,
    meta: { notifyOnError: true },
  });
}

export function useFactList(
  params: FactRequest,
  active = true,
  countryId = "",
  provinceId = "",
) {
  const mode = useDashboardStore((s) => s.mode);
  const queryClient = useQueryClient();
  const queryKey = ["fact", "list", params] as const;
  const scope = JSON.stringify(params);
  const pageRef = useRef({ scope, loading: false });
  const [pageLoading, setPageLoading] = useState<{
    scope: string;
    loading: boolean;
  }>({ scope, loading: false });
  const [pageError, setPageError] = useState<{
    scope: string;
    failed: boolean;
  }>({ scope, failed: false });
  useEffect(() => {
    pageRef.current = { scope, loading: false };
  }, [scope]);
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await getFacts({
          ...params,
          Page: 1,
          PageSize: FACT_PAGE_SIZE,
        })
      ).data,
    enabled: mode === "fact" && active,
    // 新筛选结果到达前保留上一批卡片，列表不会先闪成加载态再重排。
    placeholderData:
      mode === "fact" && active ? keepPreviousData : undefined,
    meta: { notifyOnError: true },
  });
  const hasNextPage = Boolean(
    active && query.data && query.data.items.length < query.data.total,
  );
  const fetchNextPage = async () => {
    // 占位数据期间 items 仍属上一组筛选条件，翻页会拼错页号，等新结果落地再续传。
    if (
      !hasNextPage ||
      query.isPlaceholderData ||
      query.isFetching ||
      pageRef.current.loading ||
      !active
    )
      return;
    pageRef.current.loading = true;
    setPageLoading({ scope, loading: true });
    const nextPage = Math.ceil(query.data!.items.length / FACT_PAGE_SIZE) + 1;
    try {
      const result = (
        await getFacts({ ...params, Page: nextPage, PageSize: FACT_PAGE_SIZE })
      ).data;
      queryClient.setQueryData<FactPage>(
        queryKey,
        (current) =>
          current && {
            items: [...current.items, ...result.items],
            total: result.total,
          },
      );
      setPageError({ scope, failed: false });
    } catch (error) {
      notifyRequestError(error instanceof Error ? error.message : "接口请求失败");
      setPageError({ scope, failed: true });
    } finally {
      if (pageRef.current.scope === scope) pageRef.current.loading = false;
      setPageLoading((state) =>
        state.scope === scope ? { scope, loading: false } : state,
      );
    }
  };
  return {
    ...query,
    scope,
    isPending: active && query.isPending,
    data:
      active && query.data
        ? {
            ...query.data,
            // 占位数据仍属上一组区域条件，再按新区域裁剪会整列表清空；
            // 原样保留，等新结果落地后由下面的过滤接手。
            items: query.isPlaceholderData
              ? query.data.items
              : query.data.items.filter((fact) =>
                  matchesFactFilters(fact, countryId, provinceId),
                ),
          }
        : undefined,
    hasNextPage,
    isFetchingNextPage: pageLoading.scope === scope && pageLoading.loading,
    loadMoreError: pageError.scope === scope && pageError.failed,
    fetchNextPage,
  };
}

export function useFactPoints(params: FactRequest, active = true) {
  const mode = useDashboardStore((s) => s.mode);
  const enabled = mode === "fact" && active;
  return useQuery({
    queryKey: ["fact", "points", params],
    queryFn: async () => (await getFactPoints(params)).data.items,
    enabled,
    // 筛选/搜索切换时保留上一批星点，地图只做增删而不是整层消失再重绘。
    placeholderData: enabled ? keepPreviousData : undefined,
    meta: { notifyOnError: true },
  });
}

export function useFactGeoPoints(params: GeoPointsRequest) {
  const mode = useDashboardStore((s) => s.mode);
  const enabled = Boolean(params.kinds?.length) &&
    (mode === "fact" || params.kinds?.includes("port"));
  return useQuery({
    queryKey: ["fact", "geo-points", params],
    queryFn: async () => (await getGeoPoints(params)).data.items,
    enabled,
    // 同上：切换区域或叠加类型时旧点位留在原位，等新结果到达再替换。
    placeholderData: enabled ? keepPreviousData : undefined,
    meta: { notifyOnError: true },
  });
}

export function useFactDetail(id?: string) {
  return useQuery({
    queryKey: ["fact", "detail", id],
    queryFn: async () => (await getFactDetail(id!)).data,
    enabled: Boolean(id),
    meta: { notifyOnError: true },
  });
}
