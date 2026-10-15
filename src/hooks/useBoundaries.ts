import { useQuery } from "@tanstack/react-query";
import { getBoundaries } from "@/api/dashboard";

export function useBoundaries(scope: "world" | "china") {
  return useQuery({
    queryKey: ["boundaries", "prototype-v0.9.0", scope],
    queryFn: () => getBoundaries(scope),
    staleTime: Infinity,
    meta: { notifyOnError: true },
  });
}
