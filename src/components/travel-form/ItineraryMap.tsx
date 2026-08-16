"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import { ExternalLink, MapPin, UtensilsCrossed } from "lucide-react";

export interface MapPoint {
  key: string;
  kind: "activity" | "restaurant";
  name: string;
  description: string;
  detail: string;
  budgetLevel: string;
  sourceUrl: string;
  lat: number;
  lon: number;
}

interface ItineraryMapProps {
  points: MapPoint[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  fallbackCenter: [number, number];
}

// Inline paths mirroring lucide-react's MapPin / UtensilsCrossed — divIcon only
// accepts raw HTML, so the marker glyph can't be a rendered React component.
const MARKER_ICON_PATHS: Record<MapPoint["kind"], string> = {
  activity:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  restaurant:
    '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
};

function createMarkerIcon(kind: MapPoint["kind"], selected: boolean) {
  const size = selected ? 34 : 26;
  const background = kind === "restaurant" ? "#f59e0b" : "#7c3aed";
  const iconSize = Math.round(size * 0.56);
  return L.divIcon({
    className: "itinerary-marker-icon",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${background};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transition:width .15s ease,height .15s ease;"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${MARKER_ICON_PATHS[kind]}</svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

function FitBoundsOnChange({
  points,
  fallbackCenter,
}: {
  points: MapPoint[];
  fallbackCenter: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(fallbackCenter, 12);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 15);
      return;
    }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
  }, [points, fallbackCenter, map]);

  return null;
}

function FlyToSelected({ points, selectedKey }: { points: MapPoint[]; selectedKey: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedKey) return;
    const point = points.find((candidate) => candidate.key === selectedKey);
    if (!point) return;
    map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [selectedKey, points, map]);

  return null;
}

export default function ItineraryMap({ points, selectedKey, onSelect, fallbackCenter }: ItineraryMapProps) {
  const markerRefs = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    if (!selectedKey) return;
    markerRefs.current.get(selectedKey)?.openPopup();
  }, [selectedKey]);

  return (
    <MapContainer center={fallbackCenter} zoom={13} scrollWheelZoom zoomControl={false} className="h-full w-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        detectRetina
      />
      <ZoomControl position="bottomright" />
      <FitBoundsOnChange points={points} fallbackCenter={fallbackCenter} />
      <FlyToSelected points={points} selectedKey={selectedKey} />
      {points.map((point) => (
        <Marker
          key={point.key}
          position={[point.lat, point.lon]}
          icon={createMarkerIcon(point.kind, point.key === selectedKey)}
          eventHandlers={{ click: () => onSelect(point.key) }}
          ref={(marker) => {
            if (marker) markerRefs.current.set(point.key, marker);
            else markerRefs.current.delete(point.key);
          }}
        >
          <Popup>
            <div className="min-w-[190px]">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                {point.kind === "restaurant" ? (
                  <UtensilsCrossed className="size-3.5 shrink-0 text-amber-500" />
                ) : (
                  <MapPin className="size-3.5 shrink-0 text-violet-500" />
                )}
                {point.name}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{point.description}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-zinc-400">
                <span>
                  {point.detail} · {point.budgetLevel}
                </span>
                <a
                  href={point.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-violet-600 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Source
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
