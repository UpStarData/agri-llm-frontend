import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { useRelationQueries } from "./useRelationQueries";
import { createIdlePolling } from "@/utils/idlePolling";
import { useDashboardStore } from "@/store";

export function useEntityListPolling(
  list: ReturnType<typeof useRelationQueries>["list"],
  scope: string,
) {
  const panelOpen = useDashboardStore((s) => s.drawerOpen.relation.right);
  const latest = useRef({ list, panelOpen });
  const poller = useRef<ReturnType<typeof createIdlePolling> | null>(null);
  useLayoutEffect(() => { latest.current = { list, panelOpen }; }, [list, panelOpen]);
  useEffect(() => {
    const current = createIdlePolling({
      isBusy: () => {
        const { list, panelOpen } = latest.current;
        return !panelOpen || list.isPending || list.isFetching ||
          document.hidden || !navigator.onLine;
      },
      // Infinite Query 会按顺序重取已加载的分页，保留分页结构和旧数据。
      refresh: () => latest.current.list.refetch({ cancelRefetch: false }),
    });
    poller.current = current;
    return () => {
      current.stop();
      poller.current = null;
    };
  }, [scope]);
  return {
    markActivity: useCallback(() => poller.current?.markActivity(), []),
    isRefreshing: useCallback(() => poller.current?.isRefreshing() ?? false, []),
  };
}
