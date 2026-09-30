import { useQuery } from "@tanstack/react-query";
import { queryStats } from "@/api/dashboard";
import { apiEnabled } from "@/api/request";
import { useQueryContext } from "./useQueryContext";

export function useStats() {
  const context = useQueryContext();
  return useQuery({
    queryKey: ["stats", context],
    queryFn: () => queryStats(context),
    enabled: apiEnabled,
    staleTime: 0,
  });
}
