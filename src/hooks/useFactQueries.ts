import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFactDetail,
  getFactPoints,
  getFactTaxonomy,
  getFacts,
  getGeoPoints,
} from "@/api/fact";
import type { FactPage, FactRequest, GeoPointsRequest } from "@/api/fact";
import { useDashboardStore } from "@/store";
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
  const [pageLoading, setPageLoading] = useState<{ scope: string; loading: boolean }>({ scope, loading: false });
  const [pageError, setPageError] = useState<{ scope: string; failed: boolean }>({ scope, failed: false });
  useEffect(() => {
    pageRef.current = { scope, loading: false };
  }, [scope]);
  const query = useQuery({
    queryKey,
    queryFn: async () => (await getFacts({
      ...params,
      Page: 1,
      PageSize: FACT_PAGE_SIZE,
    })).data,
    enabled: mode === "fact" && active,
    meta: { notifyOnError: true },
  });
  const hasNextPage = Boolean(active && query.data && query.data.items.length < query.data.total);
  const fetchNextPage = async () => {
    if (!hasNextPage || pageRef.current.loading || !active) return;
    pageRef.current.loading = true;
    setPageLoading({ scope, loading: true });
    const nextPage = Math.ceil(query.data!.items.length / FACT_PAGE_SIZE) + 1;
    try {
      const result = (await getFacts({ ...params, Page: nextPage, PageSize: FACT_PAGE_SIZE })).data;
      queryClient.setQueryData<FactPage>(queryKey, (current) => current && ({
        items: [...current.items, ...result.items],
        total: result.total,
      }));
      setPageError({ scope, failed: false });
    } catch {
      setPageError({ scope, failed: true });
    } finally {
      if (pageRef.current.scope === scope) pageRef.current.loading = false;
      setPageLoading((state) => state.scope === scope ? { scope, loading: false } : state);
    }
  };
  return {
    ...query,
    isPending: active && query.isPending,
    data: active && query.data ? {
      ...query.data,
      items: query.data.items.filter((fact) => matchesFactFilters(fact, countryId, provinceId)),
    } : undefined,
    hasNextPage,
    isFetchingNextPage: pageLoading.scope === scope && pageLoading.loading,
    loadMoreError: pageError.scope === scope && pageError.failed,
    fetchNextPage,
  };
}

export function useFactPoints(params: FactRequest, active = true) {
  const mode = useDashboardStore((s) => s.mode);
  return useQuery({
    queryKey: ["fact", "points", params],
    queryFn: async () => (await getFactPoints(params)).data.items,
    enabled: mode === "fact" && active,
    meta: { notifyOnError: true },
  });
}

export function useFactGeoPoints(params: GeoPointsRequest) {
  const mode = useDashboardStore((s) => s.mode);
  return useQuery({
    queryKey: ["fact", "geo-points", params],
    queryFn: async () => (await getGeoPoints(params)).data.items,
    enabled: mode === "fact" && Boolean(params.kinds?.length),
    meta: { notifyOnError: true },
  });
}

export function useFactDetail(id?: string) {
  const mode = useDashboardStore((s) => s.mode);
  return useQuery({
    queryKey: ["fact", "detail", id],
    queryFn: async () => (await getFactDetail(id!)).data,
    enabled: mode === "fact" && Boolean(id),
    meta: { notifyOnError: true },
  });
}
