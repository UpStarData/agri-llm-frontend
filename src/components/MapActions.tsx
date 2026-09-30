import { Button, Tooltip } from "antd";
import { ReadOutlined, RobotOutlined } from "@ant-design/icons";
import { useDashboardStore } from "@/store";

const MapActions = () => {
  const setAiOpen = useDashboardStore((s) => s.setAiOpen);
  const setDetailsOpen = useDashboardStore((s) => s.setDetailsOpen);

  return <div className="map-actions" aria-label="地图工作区操作">
    <Tooltip title="数据详情" placement="left">
      <Button icon={<ReadOutlined />} onClick={() => setDetailsOpen(true)}>数据详情</Button>
    </Tooltip>
    <Tooltip title="AI 分析" placement="left">
      <Button icon={<RobotOutlined />} onClick={() => setAiOpen(true)}>AI 分析</Button>
    </Tooltip>
  </div>
}

export default MapActions
