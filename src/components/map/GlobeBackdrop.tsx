import { useMemo } from "react";
import { _GlobeViewport as GlobeViewport } from "@deck.gl/core";
import StarField from "./StarField";

export default function GlobeBackdrop({
  width,
  height,
  latitude,
  zoom,
}: {
  width: number;
  height: number;
  latitude: number;
  zoom: number;
}) {
  // Measure the projected limb directly. A simple world-radius conversion
  // overestimates the visible globe in deck.gl's perspective viewport.
  const globeDiameter = useMemo(() => {
    const viewport = new GlobeViewport({
      width,
      height,
      longitude: 0,
      latitude: latitude,
      zoom: zoom,
    });
    const centerLatitude = (latitude * Math.PI) / 180;
    let radius = 0;
    for (let angle = 0; angle <= 90; angle++) {
      const arc = (angle * Math.PI) / 180;
      const latitude = Math.asin(Math.sin(centerLatitude) * Math.cos(arc));
      const longitude = Math.atan2(
        Math.sin(arc) * Math.cos(centerLatitude),
        Math.cos(arc) - Math.sin(centerLatitude) * Math.sin(latitude),
      );
      const [x, y] = viewport.project([
        (longitude * 180) / Math.PI,
        (latitude * 180) / Math.PI,
      ]);
      radius = Math.max(radius, Math.hypot(x - width / 2, y - height / 2));
    }
    return radius * 2;
  }, [width, height, latitude, zoom]);

  return (
    <>
      <StarField width={width} height={height} />
      <div
        className="map-globe-ocean"
        style={{ width: globeDiameter, height: globeDiameter }}
        aria-hidden="true"
      />
    </>
  );
}
