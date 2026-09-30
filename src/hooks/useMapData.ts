import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryMap } from "@/api/dashboard";
import { apiEnabled } from "@/api/request";
import { useDashboardStore } from "@/store";
import { useQueryContext } from "./useQueryContext";

export function useMapData() {
  const context = useQueryContext();
  const overlayVisibility = useDashboardStore((s) => s.mapOverlayVisibility);
  const overlays = useMemo(() => context.mode === "fact"
    ? (Object.keys(overlayVisibility) as (keyof typeof overlayVisibility)[]).filter((key) => overlayVisibility[key])
    : [], [context.mode, overlayVisibility]);
  const mapContext = useMemo(() => ({ ...context, overlays }), [context, overlays]);
  return useQuery({
    queryKey: ["map", mapContext],
    queryFn: () => queryMap(mapContext),
    enabled: apiEnabled,
    staleTime: 0,
  });
}
