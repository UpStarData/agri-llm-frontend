import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCommodities } from "@/api/commodity";

export const commoditiesQueryOptions = queryOptions({
  queryKey: ["commodities"],
  queryFn: async () => (await getCommodities()).data.items ?? [],
  staleTime: 10 * 60_000,
  meta: { notifyOnError: true },
});

export const useCommodities = () => useQuery(commoditiesQueryOptions);
