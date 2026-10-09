import { useEffect, useRef, useState } from "react";
import { Button, Empty } from "antd";
import {
  DownOutlined,
  UpOutlined,
  CodeOutlined,
  PauseOutlined,
  CaretRightOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { useProcessingLogs } from "@/hooks/useProcessingLogs";

const ProcessingLog = () => {
  const { mode, open, togglePanel } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      open: s.drawerOpen[s.mode].bottom,
      togglePanel: s.togglePanel,
    })),
  );
  const { logs, connection } = useProcessingLogs(mode);
  const [paused, setPaused] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !paused && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs, open, paused]);
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
          {connection && connection !== "connected" && (
            <span className="log-connection-status">
              {connection === "reconnecting"
                ? "重连中"
                : connection === "closed"
                  ? "连接已关闭"
                  : "连接中"}
            </span>
          )}
        </span>
        <Button
          type="text"
          icon={paused ? <CaretRightOutlined /> : <PauseOutlined />}
          aria-label={paused ? "恢复日志自动滚动" : "暂停日志自动滚动"}
          onClick={() => setPaused((value) => !value)}
        />
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
