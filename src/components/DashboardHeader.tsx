import { Segmented, Tooltip, Button } from "antd";
import {
  DeploymentUnitOutlined, MoonOutlined, SunOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import type { Mode } from "@/types";

const DashboardHeader = () => {
  const { mode, setMode, colorTheme, setColorTheme } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode, setMode: s.setMode, colorTheme: s.colorTheme,
      setColorTheme: s.setColorTheme,
    })),
  );
  return (
    <div className="dashboard-header">
      <div className="brand">
        <DeploymentUnitOutlined className="brand-icon" />
        <span className="brand-title">AgriLink <span>农链</span></span>
      </div>
      <Segmented<Mode | "simulation"> aria-label="地图模式" value={mode}
        onChange={(value) => { if (value !== "simulation") setMode(value); }}
        options={[
          { value: "fact", label: "事实层" },
          { value: "relation", label: "关联层" },
          { value: "simulation", label: "推演层", disabled: true },
        ]} />
      <Tooltip title={colorTheme === "dark" ? "切换为亮色主题" : "切换为暗色主题"}>
        <Button type="text" shape="circle"
          aria-label={colorTheme === "dark" ? "切换为亮色主题" : "切换为暗色主题"}
          icon={colorTheme === "dark" ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setColorTheme(colorTheme === "dark" ? "light" : "dark")} />
      </Tooltip>
    </div>
  );
};

export default DashboardHeader;
