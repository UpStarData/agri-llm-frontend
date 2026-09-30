import { useEffect, useRef, useState } from "react";
import { Button, Empty } from "antd";
import {
  DownOutlined,
  UpOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { subscribeProcessingLogs } from "@/api/processingLogs";
import type { ProcessingLogConnection } from "@/api/processingLogs";
const MAX_LOGS = 200;

const ProcessingLog = () => {
  const { mode, open, togglePanel } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      open: s.drawerOpen[s.mode].bottom,
      togglePanel: s.togglePanel,
    })),
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [connection, setConnection] = useState<ProcessingLogConnection>("connecting");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "fact") return;
    return subscribeProcessingLogs(
      (log) => setLogs((current) =>
        [...current, log].slice(-MAX_LOGS),
      ),
      setConnection,
    );
  }, [mode]);

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
      <div className="layer-drawer-header">
        <span>
          <CodeOutlined />
          {mode === "fact" ? "事实处理日志" : "关联处理日志"}
          {mode === "fact" && (
            <span className="log-connection-status">
              {connection === "connected" ? "实时" : connection === "reconnecting" ? "重连中" : connection === "closed" ? "连接已关闭" : "连接中"}
            </span>
          )}
        </span>
        <Button
          type="text"
          aria-label={`${open ? "收起" : "展开"}${mode === "fact" ? "事实" : "关联"}处理日志`}
          aria-expanded={open}
          aria-controls="processing-log-content"
          icon={open ? <DownOutlined /> : <UpOutlined />}
          onClick={() => togglePanel("bottom")}
        />
      </div>
      {open && (
        <div id="processing-log-content" className="processing-log-content" ref={contentRef}>
          {mode === "fact" && logs.length > 0 ? (
            <div className="log-entries">
              {logs.map((log, index) => (
                <pre className="log-raw-entry" key={index}>{log}</pre>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无处理记录" />
          )}
        </div>
      )}
    </div>
  );
};

export default ProcessingLog;
