import { Button } from "antd";
import {
  DeploymentUnitOutlined,
  FullscreenExitOutlined,
  EnvironmentOutlined,
  FullscreenOutlined,
  GlobalOutlined,
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useDashboardStore } from "@/store";
import FactMapTools from "./FactMapTools";
import RelationMapTools from "./RelationMapTools";
import { Tooltip } from "antd";
interface IProps {
  isGlobe: boolean;
  isGraph: boolean;
  isFullscreen: boolean;
  onViewChange: (view: "3d" | "2d" | "graph") => void;
  onToggleGlobe: () => void;
  onFullscreen: () => Promise<void>;
  onZoom: (direction: number) => void;
  onReset: () => void;
}
const MapControls = ({
  isGlobe,
  isGraph,
  isFullscreen,
  onViewChange,
  onFullscreen,
  onZoom,
}: IProps) => {
  const mode = useDashboardStore((s) => s.mode);
  const visible = useDashboardStore((s) => s.mapControlsVisible);
  if (!visible) return null;
  if (mode === "fact") return (
    <div className="map-controls map-controls-fact" aria-label="地图操作">
      <FactMapTools
        zoom={<>
          <Tooltip title="放大"><Button type="text" shape="circle" icon={<PlusOutlined />} aria-label="放大地图" onClick={() => onZoom(1)} /></Tooltip>
          <Tooltip title="缩小"><Button type="text" shape="circle" icon={<MinusOutlined />} aria-label="缩小地图" onClick={() => onZoom(-1)} /></Tooltip>
        </>}
        views={<>
          <Tooltip title="3D 地图"><Button type={isGlobe ? "primary" : "text"} shape="circle" icon={<GlobalOutlined />} aria-label="3D 地图" aria-pressed={isGlobe} onClick={() => onViewChange("3d")} /></Tooltip>
          <Tooltip title="2D 地图"><Button type={!isGlobe ? "primary" : "text"} shape="circle" icon={<EnvironmentOutlined />} aria-label="2D 地图" aria-pressed={!isGlobe} onClick={() => onViewChange("2d")} /></Tooltip>
        </>}
        fullscreen={<Tooltip title={isFullscreen ? "退出全屏" : "全屏"}><Button type="text" shape="circle" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} aria-label={isFullscreen ? "退出全屏" : "展开全屏"} onClick={onFullscreen} /></Tooltip>}
      />
    </div>
  );
  return (
    <div className="map-controls map-controls-relation" aria-label="地图操作">
      <div className="map-controls-row">
        <Tooltip title="放大"><Button type="text" shape="circle" icon={<PlusOutlined />} aria-label="放大地图" onClick={() => onZoom(1)} /></Tooltip>
        <Tooltip title="缩小"><Button type="text" shape="circle" icon={<MinusOutlined />} aria-label="缩小地图" onClick={() => onZoom(-1)} /></Tooltip>
        <Tooltip title="3D 地图"><Button type="text" shape="circle" icon={<GlobalOutlined />} aria-label="3D 地图" aria-pressed={!isGraph && isGlobe} onClick={() => onViewChange("3d")} /></Tooltip>
        <Tooltip title="2D 地图"><Button type="text" shape="circle" icon={<EnvironmentOutlined />} aria-label="2D 地图" aria-pressed={!isGraph && !isGlobe} onClick={() => onViewChange("2d")} /></Tooltip>
      </div>
      <div className="map-controls-row">
        <RelationMapTools
          graph={<Tooltip title="图谱"><Button type="text" shape="circle" icon={<DeploymentUnitOutlined />} aria-label="图谱" aria-pressed={isGraph} onClick={() => onViewChange("graph")} /></Tooltip>}
        />
        <Tooltip title={isFullscreen ? "退出全屏" : "全屏"}><Button type="text" shape="circle" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} aria-label={isFullscreen ? "退出全屏" : "展开全屏"} onClick={onFullscreen} /></Tooltip>
      </div>
    </div>
  );
};
export default MapControls;
