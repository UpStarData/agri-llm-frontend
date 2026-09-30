import { useMemo } from "react";
import { useDashboardStore } from "@/store";
import { dateRangeToUtc } from "@/utils/date";
import { factFilterIds, relationFilterIds } from "@/components/filterTaxonomy";
import type { QueryContext } from "@/types";

export function useQueryContext(): QueryContext {
  const mode = useDashboardStore((s) => s.mode);
  const level = useDashboardStore((s) => s.level);
  const regionId = useDashboardStore((s) => s.regionId);
  const range = useDashboardStore((s) => s.dateRange);
  const excludedFilterIds = useDashboardStore((s) => s.excludedFilterIds[mode]);
  const selectedIds = useMemo(() => (mode === "fact" ? factFilterIds : relationFilterIds)
    .filter((id) => !excludedFilterIds.includes(id)), [mode, excludedFilterIds]);
  return useMemo(
    () => ({
      mode,
      level,
      regionId,
      time: dateRangeToUtc(...range),
      filters: { selectedIds },
      statsScope: "region",
    }),
    [mode, level, regionId, range, selectedIds],
  );
}
