'use client';

import { useEffect, useRef, useState } from 'react';

interface LatLng {
  lat: number;
  lng: number;
}

interface GeofenceMapPickerProps {
  initialCenter?: LatLng;
  initialRadius?: number;
  onConfirm: (center: LatLng, radiusMeters: number) => void;
  onCancel: () => void;
}

export default function GeofenceMapPicker({
  initialCenter,
  initialRadius = 100,
  onConfirm,
  onCancel,
}: GeofenceMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  const defaultCenter: LatLng = initialCenter || { lat: 6.9271, lng: 79.8612 }; // Colombo, Sri Lanka

  const [center, setCenter] = useState<LatLng>(defaultCenter);
  const [radius, setRadius] = useState(initialRadius);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');

  // Initialise Leaflet after mount (client-only)
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    let L: any;
    let isMounted = true;

    // Import Leaflet dynamically — npm package, no CDN needed
    import('leaflet').then((leafletModule) => {
      if (!isMounted || !mapRef.current) return;

      L = leafletModule.default;

      // Fix default marker icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!).setView(
        [defaultCenter.lat, defaultCenter.lng],
        15
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom flora-green centre pin
      const icon = L.divIcon({
        html: `<div style="
          background:#4E9D82;
          width:20px;height:20px;
          border-radius:50%;
          border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: '',
      });

      const marker = L.marker([defaultCenter.lat, defaultCenter.lng], {
        draggable: true,
        icon,
      }).addTo(map);

      const circle = L.circle([defaultCenter.lat, defaultCenter.lng], {
        radius: initialRadius,
        color: '#4E9D82',
        fillColor: '#4E9D82',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);

      // Click map → move pin & circle
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        setCenter({ lat, lng });
      });

      // Drag marker → move circle
      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        circle.setLatLng([lat, lng]);
        setCenter({ lat, lng });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      setMapReady(true);
    }).catch((err) => {
      console.error('Failed to load Leaflet:', err);
      setError('Map could not be loaded. You can enter coordinates manually below.');
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync circle radius when slider changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  return (
    <div className="flex flex-col gap-4">
      {/* Map Container — always render the div, Leaflet mounts into it */}
      <div
        ref={mapRef}
        id="geofence-map-container"
        className="w-full rounded-xl overflow-hidden border border-flora-border shadow-inner bg-flora-darker"
        style={{ height: 320 }}
      />

      {!mapReady && !error && (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm -mt-2">
          <span className="animate-spin">⏳</span> Loading map tiles…
        </div>
      )}

      {error && (
        <div className="text-amber-400 text-xs bg-amber-900/20 border border-amber-700/40 rounded-xl p-3">
          ⚠️ {error}
        </div>
      )}

      {/* Manual coordinate fallback */}
      {error && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={center.lat}
              onChange={(e) => setCenter((c) => ({ ...c, lat: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-flora-darker border border-flora-border rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-flora-sage"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={center.lng}
              onChange={(e) => setCenter((c) => ({ ...c, lng: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-flora-darker border border-flora-border rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-flora-sage"
            />
          </div>
        </div>
      )}

      {/* Radius Slider */}
      <div className="space-y-1.5">
        <label className="text-xs text-slate-300 font-semibold flex justify-between">
          <span>Zone Radius</span>
          <span className="text-flora-sage font-extrabold">{radius} metres</span>
        </label>
        <input
          id="geofence-radius-slider"
          type="range"
          min={10}
          max={2000}
          step={10}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-flora-green h-2 rounded cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>10 m</span>
          <span>2,000 m</span>
        </div>
      </div>

      {/* Coordinate readout */}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 font-mono bg-flora-darker rounded-xl p-3 border border-flora-border">
        <span>📍 Lat: <span className="text-flora-sage">{center.lat.toFixed(6)}</span></span>
        <span>Lng: <span className="text-flora-sage">{center.lng.toFixed(6)}</span></span>
        <span>Radius: <span className="text-flora-sage">{radius} m</span></span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          id="geofence-confirm-button"
          onClick={() => onConfirm(center, radius)}
          className="flex-1 py-2.5 bg-flora-green hover:bg-flora-sage text-slate-950 font-extrabold rounded-xl text-sm transition shadow"
        >
          ✓ Confirm Zone
        </button>
        <button
          id="geofence-cancel-button"
          onClick={onCancel}
          className="px-5 py-2.5 bg-flora-darker hover:bg-flora-card border border-flora-border text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
