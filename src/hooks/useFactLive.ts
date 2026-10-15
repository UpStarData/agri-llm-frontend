import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FactPoint, FactRequest } from "@/api/fact";
import { subscribeFactPoints } from "@/api/factLive";

const EMPTY_IDS: string[] = [];

export function useFactLive(params: FactRequest, enabled: boolean) {
  const client = useQueryClient();
  const scope = JSON.stringify(params);
  const [state, setState] = useState({ scope: "", hasNew: false, ids: EMPTY_IDS });
  useEffect(() => {
    if (!enabled) return;
    const request: FactRequest = JSON.parse(scope);
    const key = ["fact", "points", request];
    let disposed = false;
    let pending = new Set<string>();
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    // 新订阅必须清除上一连接的高亮，避免切回同一视角时回放。
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ scope, hasNew: false, ids: [] });
    const refresh = async () => {
      timer = undefined;
      busy = true;
      const batch = pending;
      pending = new Set();
      try {
        // PointItem 不包含完整筛选字段，复用快照接口做分类/品种/地域/时间筛选。
        await client.invalidateQueries({ queryKey: key, exact: true }, { throwOnError: true });
        if (disposed) return;
        const points = client.getQueryData<FactPoint[]>(key) ?? [];
        const ids = points.filter((point) => batch.has(point.factId)).map((point) => point.factId);
        if (ids.length) {
          setState((previous) => ({ scope, hasNew: true, ids: [...new Set([...previous.ids, ...ids])] }));
          clearTimeout(expiry);
          expiry = setTimeout(() => {
            if (!disposed) setState((previous) => ({ ...previous, ids: [] }));
          }, 6000);
        }
      } catch {
        // 保留待高亮 ID，短暂请求失败后重试；列表提示不受影响。
        batch.forEach((id) => pending.add(id));
      } finally {
        busy = false;
        if (!disposed && pending.size) timer = setTimeout(refresh, 1000);
      }
    };
    const close = subscribeFactPoints(request.view ?? "global", (point) => {
      setState((previous) => ({ ...previous, scope, hasNew: true }));
      pending.add(point.factId);
      if (!busy && !timer) timer = setTimeout(refresh, 250);
    });
    return () => {
      disposed = true;
      close();
      clearTimeout(timer);
      clearTimeout(expiry);
    };
  }, [client, scope, enabled]);
  return {
    hasNew: enabled && state.scope === scope && state.hasNew,
    ids: enabled && state.scope === scope ? state.ids : EMPTY_IDS,
    dismiss: () => setState((previous) => ({ ...previous, hasNew: false })),
  };
}
