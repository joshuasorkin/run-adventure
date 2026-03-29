"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useCallback, useState } from "react";

interface MapPickerProps {
  apiKey: string;
  center: { latitude: number; longitude: number };
  onChange: (coords: { latitude: number; longitude: number }) => void;
}

export default function MapPicker({ apiKey, center, onChange }: MapPickerProps) {
  const [markerPos, setMarkerPos] = useState({
    lat: center.latitude,
    lng: center.longitude,
  });

  const handleMove = useCallback(
    (lat: number, lng: number) => {
      setMarkerPos({ lat, lng });
      onChange({ latitude: lat, longitude: lng });
    },
    [onChange],
  );

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const pos = e.latLng;
      if (pos) handleMove(pos.lat(), pos.lng());
    },
    [handleMove],
  );

  const handleMapClick = useCallback(
    (e: { detail: { latLng?: { lat: number; lng: number } | null } }) => {
      const pos = e.detail.latLng;
      if (pos) handleMove(pos.lat, pos.lng);
    },
    [handleMove],
  );

  return (
    <APIProvider apiKey={apiKey}>
      <div className="w-full h-48 rounded-xl overflow-hidden">
        <Map
          defaultCenter={{ lat: center.latitude, lng: center.longitude }}
          defaultZoom={15}
          mapId="quest-config-map"
          disableDefaultUI={true}
          zoomControl={true}
          gestureHandling="greedy"
          onClick={handleMapClick}
        >
          <AdvancedMarker
            position={markerPos}
            draggable={true}
            onDragEnd={handleDragEnd}
          />
        </Map>
      </div>
    </APIProvider>
  );
}
