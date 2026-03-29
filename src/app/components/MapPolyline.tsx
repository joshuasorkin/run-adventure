"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

interface MapPolylineProps {
  path: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
}

export default function MapPolyline({
  path,
  strokeColor = "#4285F4",
  strokeWeight = 4,
  strokeOpacity = 0.7,
}: MapPolylineProps) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        strokeColor,
        strokeWeight,
        strokeOpacity,
        map,
      });
    }

    polylineRef.current.setPath(path);

    return () => {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, path, strokeColor, strokeWeight, strokeOpacity]);

  return null;
}
