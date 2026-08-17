"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import { MapPin, UtensilsCrossed } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

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
  imageUrl: string | null;
}

interface ItineraryMapProps {
  points: MapPoint[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  fallbackCenter: [number, number];
}

interface Cluster {
  key: string;
  points: MapPoint[];
  lat: number;
  lon: number;
}

// Points within this many screen pixels of each other (at the current zoom)
// are merged into a single pill marker.
const CLUSTER_PIXEL_DISTANCE = 36;

// Inline paths mirroring lucide-react's MapPin / UtensilsCrossed — divIcon only
// accepts raw HTML, so the marker glyph can't be a rendered React component.
const MARKER_ICON_PATHS: Record<MapPoint["kind"], string> = {
  activity:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  restaurant:
    '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
};

/** Builds a single-place pin icon (purple for activities, amber for restaurants), larger when selected.
 * Uses `L.divIcon` with raw HTML/inline SVG rather than a React component or image file — Leaflet
 * markers render outside React's tree, and this sidesteps the usual broken-marker-icon issue with bundlers. */
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

/** Builds the pill icon for a cluster of nearby points — shows the count, and a gradient
 * background when the cluster mixes activities and restaurants. */
function createClusterIcon(clusterPoints: MapPoint[]) {
  const count = clusterPoints.length;
  const hasActivity = clusterPoints.some((p) => p.kind === "activity");
  const hasRestaurant = clusterPoints.some((p) => p.kind === "restaurant");
  const background =
    hasActivity && hasRestaurant
      ? "linear-gradient(135deg, #7c3aed, #f59e0b)"
      : hasRestaurant
        ? "#f59e0b"
        : "#7c3aed";
  const width = 24 + String(count).length * 9;
  const height = 28;
  return L.divIcon({
    className: "itinerary-cluster-icon",
    html: `<div style="min-width:${width}px;height:${height}px;padding:0 10px;border-radius:9999px;background:${background};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;">${count}</div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

/** Greedily groups `points` that project within `CLUSTER_PIXEL_DISTANCE` screen pixels of each
 * other at the map's current zoom/pan — recomputed on every zoom/move (see `ClusteredMarkers`),
 * since the same lat/lon points can be pixels apart at one zoom and overlapping at another. */
function clusterPoints(map: L.Map, points: MapPoint[]): Cluster[] {
  const projected = points.map((point) => ({
    point,
    px: map.latLngToContainerPoint([point.lat, point.lon]),
  }));
  const used = new Set<number>();
  const clusters: Cluster[] = [];

  for (let i = 0; i < projected.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const group = [projected[i]];
    for (let j = i + 1; j < projected.length; j++) {
      if (used.has(j)) continue;
      if (projected[i].px.distanceTo(projected[j].px) < CLUSTER_PIXEL_DISTANCE) {
        group.push(projected[j]);
        used.add(j);
      }
    }
    const groupPoints = group.map((entry) => entry.point);
    clusters.push({
      key: groupPoints.map((p) => p.key).join("|"),
      points: groupPoints,
      lat: groupPoints.reduce((sum, p) => sum + p.lat, 0) / groupPoints.length,
      lon: groupPoints.reduce((sum, p) => sum + p.lon, 0) / groupPoints.length,
    });
  }

  return clusters;
}

/** Popup body for a single (non-clustered) marker — photo, name, description, duration/cuisine + budget. */
function PlacePopupContent({ point }: { point: MapPoint }) {
  return (
    <div className="min-w-[190px]">
      {point.imageUrl && (
        <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg">
          <Image src={point.imageUrl} alt={point.name} fill sizes="190px" className="object-cover" />
        </div>
      )}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
        {point.kind === "restaurant" ? (
          <UtensilsCrossed className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <MapPin className="size-3.5 shrink-0 text-violet-500" />
        )}
        {point.name}
      </div>
      <p className="mt-1 text-xs text-zinc-500">{point.description}</p>
      <p className="mt-1.5 text-xs text-zinc-400">
        {point.detail} · {point.budgetLevel}
      </p>
    </div>
  );
}

/** Renders every point as either a single pin (with its popup) or a clustered pill (whose popup
 * lists the grouped places, clicking one selecting it; clicking the cluster itself zooms/fits to
 * it). Keeps `selectedKey`'s marker's popup open, syncing with the sidebar selection in `ItineraryMapView`. */
function ClusteredMarkers({
  points,
  selectedKey,
  onSelect,
}: {
  points: MapPoint[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const map = useMap();
  const { t } = useLanguage();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const markerRefs = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    function recompute() {
      setClusters(clusterPoints(map, points));
    }
    recompute();
    map.on("zoomend", recompute);
    map.on("moveend", recompute);
    return () => {
      map.off("zoomend", recompute);
      map.off("moveend", recompute);
    };
  }, [map, points]);

  useEffect(() => {
    if (!selectedKey) return;
    markerRefs.current.get(selectedKey)?.openPopup();
  }, [selectedKey, clusters]);

  function handleClusterClick(cluster: Cluster) {
    const bounds = L.latLngBounds(cluster.points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [64, 64], maxZoom: 19 });
  }

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.points.length === 1) {
          const point = cluster.points[0];
          return (
            <Marker
              key={cluster.key}
              position={[point.lat, point.lon]}
              icon={createMarkerIcon(point.kind, point.key === selectedKey)}
              eventHandlers={{ click: () => onSelect(point.key) }}
              ref={(marker) => {
                if (marker) markerRefs.current.set(point.key, marker);
                else markerRefs.current.delete(point.key);
              }}
            >
              <Popup>
                <PlacePopupContent point={point} />
              </Popup>
            </Marker>
          );
        }

        return (
          <Marker
            key={cluster.key}
            position={[cluster.lat, cluster.lon]}
            icon={createClusterIcon(cluster.points)}
            eventHandlers={{ click: () => handleClusterClick(cluster) }}
          >
            <Popup>
              <div className="min-w-[190px]">
                <p className="mb-1.5 text-xs font-semibold text-zinc-500">
                  {t("itineraryMap.samePlace", { count: cluster.points.length })}
                </p>
                <div className="flex flex-col gap-0.5">
                  {cluster.points.map((point) => (
                    <button
                      key={point.key}
                      type="button"
                      onClick={() => onSelect(point.key)}
                      className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs text-zinc-700 transition hover:bg-zinc-100"
                    >
                      {point.kind === "restaurant" ? (
                        <UtensilsCrossed className="size-3 shrink-0 text-amber-500" />
                      ) : (
                        <MapPin className="size-3 shrink-0 text-violet-500" />
                      )}
                      <span className="truncate">{point.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

/** Tells Leaflet to recompute its internal size whenever its container is resized (e.g. the
 * mobile map panel expanding/collapsing) — without this, Leaflet keeps rendering at its old
 * size and shows gray/blank tiles until the next manual interaction. */
function InvalidateSizeOnResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/** Recenters/refits the map whenever the visible point set changes (e.g. the day filter
 * changes) — zooms to the single point, fits bounds around several, or falls back to
 * `fallbackCenter` if there's nothing geocoded to show. */
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

/** Smoothly flies the map to the selected point (e.g. after clicking a sidebar card), without
 * zooming back out if the map is already more zoomed in than the target level. */
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

/**
 * Pure Leaflet map for the trip detail page — plots `points` as clustered pins on CARTO Voyager
 * tiles. Always loaded via `next/dynamic(..., { ssr: false })` from `ItineraryMapView.tsx`,
 * since Leaflet touches `window` at import time and would break server rendering otherwise.
 */
export default function ItineraryMap({ points, selectedKey, onSelect, fallbackCenter }: ItineraryMapProps) {
  return (
    <MapContainer center={fallbackCenter} zoom={13} scrollWheelZoom zoomControl={false} className="h-full w-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        detectRetina
      />
      <ZoomControl position="bottomright" />
      <InvalidateSizeOnResize />
      <FitBoundsOnChange points={points} fallbackCenter={fallbackCenter} />
      <FlyToSelected points={points} selectedKey={selectedKey} />
      <ClusteredMarkers points={points} selectedKey={selectedKey} onSelect={onSelect} />
    </MapContainer>
  );
}
