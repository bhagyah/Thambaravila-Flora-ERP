'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface LatLng {
  lat: number;
  lng: number;
}

interface GeofenceMapPickerProps {
  initialCenter?: LatLng;
  initialRadius?: number;
  onChange?: (center: LatLng, radiusMeters: number) => void;
  onConfirm?: (center: LatLng, radiusMeters: number) => void;
  onCancel?: () => void;
}

export default function GeofenceMapPicker({
  initialCenter,
  initialRadius = 100,
  onChange,
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
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [locMsg, setLocMsg] = useState('');

  // Notify parent of initial state
  useEffect(() => {
    onChange?.(defaultCenter, initialRadius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map and objects when center changes manually
  const updateMapPosition = useCallback((newCenter: LatLng) => {
    setCenter(newCenter);
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([newCenter.lat, newCenter.lng]);
      circleRef.current.setLatLng([newCenter.lat, newCenter.lng]);
      mapInstanceRef.current.panTo([newCenter.lat, newCenter.lng]);
    }
  }, []);

  // Initialise Leaflet after mount (client-only)
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    let L: any;
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    // Import Leaflet dynamically
    import('leaflet').then((leafletModule) => {
      if (!isMounted || !mapRef.current) return;

      L = leafletModule.default;

      // Fix default marker icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [defaultCenter.lat, defaultCenter.lng],
        zoom: 16,
        zoomControl: true,
      });

      // Standard OSM Tile Layer with subdomains
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Custom flora-green centre pin
      const icon = L.divIcon({
        html: `<div style="
          background:#4E9D82;
          width:22px;height:22px;
          border-radius:50%;
          border:3px solid #ffffff;
          box-shadow:0 2px 10px rgba(0,0,0,0.6);
          display:flex;
          align-items:center;
          justify-content:center;
        "><div style="width:6px;height:6px;background:#ffffff;border-radius:50%;"></div></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: 'geofence-picker-pin',
      });

      const marker = L.marker([defaultCenter.lat, defaultCenter.lng], {
        draggable: true,
        icon,
      }).addTo(map);

      const circle = L.circle([defaultCenter.lat, defaultCenter.lng], {
        radius: initialRadius,
        color: '#4E9D82',
        fillColor: '#4E9D82',
        fillOpacity: 0.16,
        weight: 2,
      }).addTo(map);

      // Click map → move pin & circle
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        setCenter({ lat, lng });
        onChange?.({ lat, lng }, radius);
      });

      // Drag marker → move circle
      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        circle.setLatLng([lat, lng]);
        setCenter({ lat, lng });
        onChange?.({ lat, lng }, radius);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      setMapReady(true);

      // Ensure proper container sizing inside modal
      map.whenReady(() => {
        map.invalidateSize();
        setTimeout(() => { if (isMounted && mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 150);
        setTimeout(() => { if (isMounted && mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 400);
      });

      if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapRef.current);
      }
    }).catch((err) => {
      console.error('Failed to load Leaflet:', err);
      setError('Map could not be loaded. You can enter coordinates manually below.');
    });

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
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
    onChange?.(center, radius);
  }, [radius, center, onChange]);

  // Handle GPS location lookup
  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocMsg('Geolocation is not supported by your browser.');
      setTimeout(() => setLocMsg(''), 4000);
      return;
    }

    setLocating(true);
    setLocMsg('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        const newCenter = { lat: newLat, lng: newLng };
        updateMapPosition(newCenter);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 17);
        }
        onChange?.(newCenter, radius);
        setLocMsg(`📍 Located! Accuracy: ±${Math.round(pos.coords.accuracy)}m`);
        setTimeout(() => setLocMsg(''), 4000);
      },
      (err) => {
        setLocating(false);
        setLocMsg(`Could not get location: ${err.message}`);
        setTimeout(() => setLocMsg(''), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Map Header bar with Quick Action */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Click map or drag the green pin to set center:
        </span>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="text-xs font-semibold px-3 py-1.5 bg-flora-card hover:bg-flora-darker border border-flora-border text-flora-sage hover:text-emerald-300 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
        >
          {locating ? <span className="animate-spin">⏳</span> : <span>📍</span>}
          {locating ? 'Locating…' : 'Use My Current Location'}
        </button>
      </div>

      {locMsg && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-medium">
          {locMsg}
        </div>
      )}

      {/* Map Container — relative & explicit height */}
      <div className="relative w-full rounded-xl overflow-hidden border border-flora-border shadow-inner bg-flora-darker">
        <div
          ref={mapRef}
          id="geofence-map-container"
          className="w-full h-80 z-0"
        />

        {!mapReady && !error && (
          <div className="absolute inset-0 bg-flora-darker/90 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm z-10">
            <span className="animate-spin text-2xl">⏳</span>
            <span>Loading interactive map…</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-amber-400 text-xs bg-amber-900/20 border border-amber-700/40 rounded-xl p-3">
          ⚠️ {error}
        </div>
      )}

      {/* Coordinate & Radius Editor */}
      <div className="grid grid-cols-2 gap-3 bg-flora-darker/80 p-3 rounded-xl border border-flora-border">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
            Latitude
          </label>
          <input
            type="number"
            step="0.000001"
            value={center.lat}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              const nextCenter = { ...center, lat: val };
              updateMapPosition(nextCenter);
              onChange?.(nextCenter, radius);
            }}
            className="w-full bg-flora-darker border border-flora-border rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-flora-sage"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
            Longitude
          </label>
          <input
            type="number"
            step="0.000001"
            value={center.lng}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              const nextCenter = { ...center, lng: val };
              updateMapPosition(nextCenter);
              onChange?.(nextCenter, radius);
            }}
            className="w-full bg-flora-darker border border-flora-border rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-flora-sage"
          />
        </div>
      </div>

      {/* Radius Slider */}
      <div className="space-y-1.5 bg-flora-darker/80 p-3 rounded-xl border border-flora-border">
        <label className="text-xs text-slate-300 font-semibold flex justify-between">
          <span>Zone Acceptance Radius</span>
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
          <span>10 m (strict door check)</span>
          <span>2,000 m (wide boundary)</span>
        </div>
      </div>

      {/* Action Buttons if onConfirm / onCancel requested */}
      {(onConfirm || onCancel) && (
        <div className="flex gap-3">
          {onConfirm && (
            <button
              id="geofence-confirm-button"
              type="button"
              onClick={() => onConfirm(center, radius)}
              className="flex-1 py-2.5 bg-flora-green hover:bg-flora-sage text-slate-950 font-extrabold rounded-xl text-sm transition shadow"
            >
              ✓ Confirm Location ({radius}m)
            </button>
          )}
          {onCancel && (
            <button
              id="geofence-cancel-button"
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-flora-darker hover:bg-flora-card border border-flora-border text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
