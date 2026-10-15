import { Segmented, Tooltip, Button } from "antd";
import {
  MoonOutlined,
  SunOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import type { Mode } from "@/types";
import logo from '@/assets/logo.png'

const panelLabels = { left: "左侧菜单", right: "右侧菜单", bottom: "处理日志" };
const panelIcons = { left: <FilterOutlined />, right: <UnorderedListOutlined />, bottom: <CodeOutlined /> };

const DashboardHeader = () => {
  const { mode, setMode, colorTheme, setColorTheme } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      setMode: s.setMode,
      colorTheme: s.colorTheme,
      setColorTheme: s.setColorTheme,
    })),
  );
  const panels = useDashboardStore((s) => s.drawerOpen[s.mode]);
  const togglePanel = useDashboardStore((s) => s.togglePanel);
  return (
    <div className="dashboard-header">
      <div className="brand">
        <img src={logo} alt="" className="brand-icon" />
        <span className="brand-title">
          AgriLink <span>农链</span>
        </span>
      </div>
      <Segmented<Mode | "simulation">
        className="dashboard-mode-switch"
        aria-label="地图模式"
        value={mode}
        onChange={(value) => {
          if (value !== "simulation") setMode(value);
        }}
        options={[
          { value: "fact", label: "事实层" },
          { value: "relation", label: "关联层" },
          { value: "simulation", label: "推演层", disabled: true },
        ]}
      />
      <div className="header-panel-controls">
        {(["left", "right", "bottom"] as const).map((side) => (
          <Tooltip key={side} title={panelLabels[side]}>
            <Button
              type={panels[side] ? "primary" : "text"}
              shape="circle"
              icon={panelIcons[side]}
              onClick={() => togglePanel(side)}
              aria-label={panelLabels[side]}
              aria-pressed={panels[side]}
              aria-controls={{ left: "layer-menu", right: "layer-records", bottom: "processing-log" }[side]}
            />
          </Tooltip>
        ))}
        <Tooltip
          title={colorTheme === "dark" ? "切换为亮色主题" : "切换为暗色主题"}
        >
          <Button
            type="text"
            shape="circle"
            aria-label={
              colorTheme === "dark" ? "切换为亮色主题" : "切换为暗色主题"
            }
            icon={colorTheme === "dark" ? <SunOutlined /> : <MoonOutlined />}
            onClick={() =>
              setColorTheme(colorTheme === "dark" ? "light" : "dark")
            }
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardHeader;
