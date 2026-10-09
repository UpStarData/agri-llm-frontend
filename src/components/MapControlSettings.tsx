import { Checkbox } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";

const controlItems = [
  { key: "globe", label: "2D / 3D" },
  { key: "fullscreen", label: "全屏" },
  { key: "zoom", label: "放大 / 缩小" },
  { key: "reset", label: "复位视角" },
  { key: "influence", label: "地理影响圆" },
  { key: "video", label: "视频" },
  { key: "search", label: "搜索" },
] as const;
const relationControlItems = [
  { key: "globe", label: "3D / 2D" },
  { key: "graph", label: "图谱" },
  { key: "zoom", label: "放大 / 缩小" },
  { key: "fullscreen", label: "全屏" },
  { key: "ports", label: "港口锚点" },
  { key: "search", label: "搜索" },
] as const;

const MapControlSettings = () => {
  const { mode, visibility, setVisibility, setAllVisibility } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      visibility: s.mapControlVisibility,
      setVisibility: s.setMapControlVisibility,
      setAllVisibility: s.setAllMapControlVisibility,
    })),
  );
  const items = mode === "relation" ? relationControlItems : controlItems;
  const selectedCount = items.filter(
    ({ key }) => visibility[key],
  ).length;

  return (
    <div className="menu-section">
      <div className="drawer-control-header">
        <div className="menu-section-title">地图快捷控制</div>
        <Checkbox
          aria-label="显示全部地图快捷控制"
          checked={selectedCount === items.length}
          indeterminate={
            selectedCount > 0 && selectedCount < items.length
          }
          onChange={(event) => setAllVisibility(event.target.checked)}
        />
      </div>
      <div className="map-control-options">
        {items.map(({ key, label }) => (
          <Checkbox
            key={key}
            checked={visibility[key]}
            onChange={(event) => setVisibility(key, event.target.checked)}
          >
            {label}
          </Checkbox>
        ))}
      </div>
    </div>
  );
};

export default MapControlSettings;
