import { useEffect, useState } from "react";
import { subscribeProcessingLogs } from "@/api/processingLogs";
import type { ProcessingLogConnection } from "@/api/processingLogs";
import type { Mode } from "@/types";
import { useDashboardStore } from "@/store";

const MAX_LOGS = 200;
// 关联 SSE 尚未开发；后端就绪后在此启用，复用同一订阅流程。
const enabledByMode: Record<Mode, boolean> = { fact: true, relation: false };

/** 面板收起仍接收当前层消息，切层/卸载时释放旧连接。 */
export function useProcessingLogs(mode: Mode) {
  const [logsByMode, setLogs] = useState<Record<Mode, string[]>>({
    fact: [],
    relation: [],
  });
  const [connection, setConnection] =
    useState<ProcessingLogConnection>("connecting");
  useEffect(() => {
    if (!enabledByMode[mode]) return;
    return subscribeProcessingLogs(
      mode,
      (log, event) => {
        setLogs((current) => ({
          ...current,
          [mode]: [...current[mode], log].slice(-MAX_LOGS),
        }));
        if (
          mode === "relation" &&
          event &&
          (event.entityIds?.length || event.relationIds?.length)
        ) {
          useDashboardStore
            .getState()
            .glowRelation(event.entityIds ?? [], event.relationIds ?? []);
        }
      },
      setConnection,
    );
  }, [mode]);
  return {
    logs: logsByMode[mode],
    connection: enabledByMode[mode] ? connection : undefined,
  };
}
