import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCommodities } from "@/api/commodity";

/** 品种名 → 品种 ID（UUID v7）映射；接口未就绪时为空映射（品种筛选退化为全部品种）。 */
export function useCommodityNameToId(): Record<string, string> {
  const query = useQuery({
    queryKey: ["commodities"],
    queryFn: async () => (await getCommodities()).data.items,
    staleTime: 10 * 60_000,
    meta: { notifyOnError: true },
  });
  return useMemo(
    () =>
      Object.fromEntries((query.data ?? []).map(({ id, name }) => [name, id])),
    [query.data],
  );
}

/** 品种 ID → 品种名映射（展示用）；接口未就绪时为空映射。 */
export function useCommodityIdToName(): Record<string, string> {
  const query = useQuery({
    queryKey: ["commodities"],
    queryFn: async () => (await getCommodities()).data.items,
    staleTime: 10 * 60_000,
    meta: { notifyOnError: true },
  });
  return useMemo(
    () =>
      Object.fromEntries((query.data ?? []).map(({ id, name }) => [id, name])),
    [query.data],
  );
}
