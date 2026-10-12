export const ENTITY_POLL_INTERVAL = 30_000;
export const SCROLL_IDLE_DELAY = 800;

/** 到期后等待交互和分页请求结束；同一时间只执行一次刷新。 */
export function createIdlePolling({
  isBusy,
  refresh,
  interval = ENTITY_POLL_INTERVAL,
}: {
  isBusy: () => boolean;
  refresh: () => Promise<unknown>;
  interval?: number;
}) {
  let stopped = false;
  let refreshing = false;
  let lastActivity = -Infinity;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = (delay: number) => {
    if (!stopped) timer = setTimeout(() => void tick(), delay);
  };
  const tick = async () => {
    if (stopped) return;
    if (isBusy() || Date.now() - lastActivity < SCROLL_IDLE_DELAY) {
      schedule(200);
      return;
    }
    refreshing = true;
    try {
      await refresh();
    } catch {
      // 查询层负责错误展示，失败后仍继续下一轮轮询。
    } finally {
      refreshing = false;
      schedule(interval);
    }
  };
  schedule(interval);
  return {
    markActivity: () => { lastActivity = Date.now(); },
    isRefreshing: () => refreshing,
    stop: () => { stopped = true; clearTimeout(timer); },
  };
}
