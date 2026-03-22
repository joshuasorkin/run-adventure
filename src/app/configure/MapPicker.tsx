"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useCallback } from "react";

interface MapPickerProps {
  apiKey: string;
  center: { latitude: number; longitude: number };
  onChange: (coords: { latitude: number; longitude: number }) => void;
}

export default function MapPicker({ apiKey, center, onChange }: MapPickerProps) {
  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const pos = e.latLng;
      if (pos) {
        onChange({ latitude: pos.lat(), longitude: pos.lng() });
      }
    },
    [onChange],
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
        >
          <AdvancedMarker
            position={{ lat: center.latitude, lng: center.longitude }}
            draggable={true}
            onDragEnd={handleDragEnd}
          />
        </Map>
      </div>
    </APIProvider>
  );
}
