import { useEffect, useRef } from "react";
import { Empty } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { useProcessingLogs } from "@/hooks/useProcessingLogs";

const ProcessingLog = () => {
  const { mode, open } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      open: s.drawerOpen[s.mode].bottom,
    })),
  );
  const { logs } = useProcessingLogs(mode);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs, open]);
  return (
    <div
      id="processing-log"
      className={`processing-log${open ? " is-open" : ""}`}
      role="region"
      aria-label={mode === "fact" ? "事实处理日志" : "关联处理日志"}
    >
      {open && <div className="processing-log-title">接入流</div>}
      {open && (
        <div
          id="processing-log-content"
          className="processing-log-content"
          ref={contentRef}
        >
          {logs.length > 0 ? (
            <div className="log-entries">
              {logs.map((log, index) => (
                <pre className="log-raw-entry" key={index}>
                  {log}
                </pre>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无处理记录"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ProcessingLog;
