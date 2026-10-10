import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCommodities } from "@/api/fact";

export const commoditiesQueryOptions = queryOptions({
  queryKey: ["commodities"],
  queryFn: async () => (await getCommodities()).data.items ?? [],
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  meta: { notifyOnError: true },
});

export const useCommodities = () => useQuery(commoditiesQueryOptions);
