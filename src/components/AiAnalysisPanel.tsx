import { Drawer, Empty, Tag } from "antd";
import { useDashboardStore } from "@/store";

const AiAnalysisPanel = () => {
  const open = useDashboardStore((s) => s.aiOpen);
  const setOpen = useDashboardStore((s) => s.setAiOpen);
  return (
    <Drawer
      title="AI 分析"
      open={open}
      onClose={() => setOpen(false)}
      size={420}
    >
      <Tag color="cyan">分析结果将关联事实与来源</Tag>
      <Empty className="ai-empty" description="分析服务待接入" />
      <p className="muted">
        接入后可针对当前区域、时间和所选对象发起分析，并回溯回答所引用的事实。
      </p>
    </Drawer>
  );
}

export default AiAnalysisPanel
