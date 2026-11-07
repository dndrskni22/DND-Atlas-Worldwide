import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Carrier,
  GroupConfigSettings,
  Location,
  LocationType,
  Shipment,
  ShipmentStatus,
  TrackingEvent,
  TransportMode,
} from '../types/cargotrace';
import { EtaService, calculateHaversineKm } from '../services/CargoTraceService';
import {
  Anchor,
  Plane,
  Truck,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  MapPin,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CargoTraceLeafletMapProps {
  shipments: Shipment[];
  locations: Location[];
  carriers: Carrier[];
  trackingEvents: TrackingEvent[];
  settings: GroupConfigSettings;
  selectedShipmentId?: number | null;
  onSelectShipment?: (shipment: Shipment) => void;
  heightClass?: string;
  compactControlDefault?: boolean;
}

// Helper to build clean inline SVG DivIcon for Leaflet markers
function createModeDivIcon(
  mode: TransportMode,
  isDelayed: boolean,
  isSelected: boolean
): L.DivIcon {
  const bg = isDelayed
    ? '#FD6E88'
    : mode === TransportMode.SEA
    ? '#072D59'
    : mode === TransportMode.AIR
    ? '#3E6FB4'
    : '#2F8F9A';
  const ring = isDelayed ? '#FFE4E8' : isSelected ? '#FFFFFF' : '#DBF2FC';

  const svgGlyph =
    mode === TransportMode.SEA
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>`
      : mode === TransportMode.AIR
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

  const size = isSelected ? 34 : 28;
  return L.divIcon({
    className: 'ct-leaflet-marker',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:3px solid ${ring};box-shadow:0 2px 8px rgba(7,45,89,0.28);display:flex;align-items:center;justify-content:center;cursor:pointer;">${svgGlyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createLocationHubIcon(type: LocationType): L.DivIcon {
  const color =
    type === LocationType.SEAPORT
      ? '#072D59'
      : type === LocationType.AIRPORT
      ? '#3E6FB4'
      : '#2F8F9A';

  return L.divIcon({
    className: 'ct-hub-marker',
    html: `<div style="width:12px;height:12px;border-radius:9999px;background:#DBF2FC;border:2.5px solid ${color};box-shadow:0 1px 4px rgba(7,45,89,0.22);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6],
  });
}

export const CargoTraceLeafletMap: React.FC<CargoTraceLeafletMapProps> = ({
  shipments,
  locations,
  carriers,
  trackingEvents,
  settings,
  selectedShipmentId = null,
  onSelectShipment,
  heightClass = 'h-[520px]',
  compactControlDefault = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectShipment);
  onSelectRef.current = onSelectShipment;

  // Independent Layer Visibility State (SEA, AIR, ROAD, Hubs, Delayed-Only)
  const [visibleModes, setVisibleModes] = useState<Record<TransportMode, boolean>>({
    [TransportMode.SEA]: true,
    [TransportMode.AIR]: true,
    [TransportMode.ROAD]: true,
  });
  const [showHubs, setShowHubs] = useState<boolean>(true);
  const [delayedOnly, setDelayedOnly] = useState<boolean>(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(compactControlDefault);

  // Per-mode shipment counts for the Layer Toggle panel
  const layerCounts = useMemo(() => {
    const sea = shipments.filter((s) => s.mode === TransportMode.SEA).length;
    const air = shipments.filter((s) => s.mode === TransportMode.AIR).length;
    const road = shipments.filter((s) => s.mode === TransportMode.ROAD).length;
    const delayed = shipments.filter((s) => {
      const ev = EtaService.evaluate(s.expected_arrival, s.estimated_arrival, settings);
      return ev.is_delayed && s.status !== ShipmentStatus.DELIVERED;
    }).length;
    return {
      [TransportMode.SEA]: sea,
      [TransportMode.AIR]: air,
      [TransportMode.ROAD]: road,
      delayed,
    };
  }, [shipments, settings]);

  // Shipments filtered by the independent Layer Toggle state
  const layerVisibleShipments = useMemo(() => {
    return shipments.filter((sh) => {
      if (!visibleModes[sh.mode]) return false;
      if (delayedOnly) {
        const ev = EtaService.evaluate(sh.expected_arrival, sh.estimated_arrival, settings);
        return ev.is_delayed && sh.status !== ShipmentStatus.DELIVERED;
      }
      return true;
    });
  }, [shipments, visibleModes, delayedOnly, settings]);

  const toggleModeLayer = (mode: TransportMode) => {
    setVisibleModes((prev) => ({
      ...prev,
      [mode]: !prev[mode],
    }));
  };

  const isCustomFiltered =
    !visibleModes[TransportMode.SEA] ||
    !visibleModes[TransportMode.AIR] ||
    !visibleModes[TransportMode.ROAD] ||
    !showHubs ||
    delayedOnly;

  const resetAllLayers = () => {
    setVisibleModes({
      [TransportMode.SEA]: true,
      [TransportMode.AIR]: true,
      [TransportMode.ROAD]: true,
    });
    setShowHubs(true);
    setDelayedOnly(false);
  };

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [18.0, 62.0], // Centered to show Southeast Asia <-> Europe corridor
      zoom: 3,
      minZoom: 2,
      maxZoom: 15,
      scrollWheelZoom: true,
    });

    // OpenStreetMap tile layer with required attribution (Slide 9)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · CargoTrace WGS84',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Render locations, route polylines, and active shipment markers based on Layer Toggle state
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const locMap = new Map<number, Location>();
    locations.forEach((l) => locMap.set(l.id, l));

    const carrierMap = new Map<number, Carrier>();
    carriers.forEach((c) => carrierMap.set(c.id, c));

    // 1. Render Logistics Hubs (Seaports, Airports, Depots) if enabled in Layer Toggle
    if (showHubs) {
      locations.forEach((loc) => {
        // Optional smart filtering: hide Seaports if SEA & ROAD are both off, etc.
        const relevantToActiveModes =
          (loc.type === LocationType.SEAPORT &&
            (visibleModes[TransportMode.SEA] || visibleModes[TransportMode.ROAD])) ||
          (loc.type === LocationType.AIRPORT &&
            (visibleModes[TransportMode.AIR] || visibleModes[TransportMode.ROAD])) ||
          (loc.type === LocationType.DEPOT && visibleModes[TransportMode.ROAD]);

        if (!relevantToActiveModes) return;

        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: createLocationHubIcon(loc.type),
        });
        marker.bindPopup(`
          <div style="min-width:195px;">
            <div style="font-size:11px;font-weight:700;color:#4B5C78;letter-spacing:0.03em;">${loc.type} · ${loc.code}</div>
            <div style="font-size:13.5px;font-weight:700;color:#072D59;margin-top:2px;">${loc.name}</div>
            <div style="font-size:12px;color:#243350;">${loc.city}, ${loc.country}</div>
            <div style="font-size:11px;color:#4B5C78;margin-top:4px;font-family:monospace;">WGS84: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}</div>
          </div>
        `);
        marker.addTo(layerGroup);
      });
    }

    // 2. Render Visible Shipments and straight-segment route polylines
    const boundsPoints: L.LatLngExpression[] = [];

    layerVisibleShipments.forEach((sh) => {
      const origin = locMap.get(sh.origin_location_id);
      const dest = locMap.get(sh.destination_location_id);
      if (!origin || !dest) return;

      const carrier = carrierMap.get(sh.carrier_id);
      const etaEval = EtaService.evaluate(
        sh.expected_arrival,
        sh.estimated_arrival,
        settings
      );
      const isDelayed =
        etaEval.is_delayed && sh.status !== ShipmentStatus.DELIVERED;
      const isSelected = selectedShipmentId === sh.id;

      // Find latest valid tracking event for current position
      const shEvents = trackingEvents
        .filter((ev) => ev.shipment_id === sh.id)
        .sort(
          (a, b) =>
            new Date(a.event_timestamp).getTime() -
            new Date(b.event_timestamp).getTime()
        );

      const latestEvent =
        shEvents.length > 0 ? shEvents[shEvents.length - 1] : null;

      let currentLat = (origin.latitude + dest.latitude) / 2;
      let currentLng = (origin.longitude + dest.longitude) / 2;
      let currentLocationLabel = `${origin.city} → ${dest.city} Corridor`;

      if (sh.status === ShipmentStatus.DELIVERED) {
        currentLat = dest.latitude;
        currentLng = dest.longitude;
        currentLocationLabel = `${dest.name} (${dest.city})`;
      } else if (
        latestEvent &&
        typeof latestEvent.latitude === 'number' &&
        typeof latestEvent.longitude === 'number'
      ) {
        currentLat = latestEvent.latitude;
        currentLng = latestEvent.longitude;
        currentLocationLabel = latestEvent.location_name;
      } else if (
        sh.status === ShipmentStatus.CREATED ||
        sh.status === ShipmentStatus.BOOKED
      ) {
        currentLat = origin.latitude;
        currentLng = origin.longitude;
        currentLocationLabel = `${origin.name} (${origin.city})`;
      }

      // Straight route segments (Origin -> Current -> Destination)
      const polyColor = isDelayed
        ? '#FD6E88'
        : sh.mode === TransportMode.SEA
        ? '#072D59'
        : sh.mode === TransportMode.AIR
        ? '#3E6FB4'
        : '#2F8F9A';

      const routeCoords: L.LatLngExpression[] = [
        [origin.latitude, origin.longitude],
        [currentLat, currentLng],
        [dest.latitude, dest.longitude],
      ];

      L.polyline(routeCoords, {
        color: polyColor,
        weight: isSelected ? 3.5 : 2.2,
        opacity: isSelected ? 0.95 : 0.65,
        dashArray: sh.status === ShipmentStatus.IN_TRANSIT ? '6, 5' : undefined,
      }).addTo(layerGroup);

      if (isSelected) {
        boundsPoints.push([origin.latitude, origin.longitude]);
        boundsPoints.push([currentLat, currentLng]);
        boundsPoints.push([dest.latitude, dest.longitude]);
      }

      const distKm = calculateHaversineKm(
        origin.latitude,
        origin.longitude,
        dest.latitude,
        dest.longitude
      );

      const marker = L.marker([currentLat, currentLng], {
        icon: createModeDivIcon(sh.mode, isDelayed, isSelected),
      });

      const popupContainer = document.createElement('div');
      popupContainer.style.minWidth = '235px';
      popupContainer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
          <span style="font-family:monospace;font-weight:700;font-size:12.5px;color:#072D59;">${sh.shipment_number}</span>
          <span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:${
            isDelayed ? '#FFF0F3' : '#DBF2FC'
          };color:${isDelayed ? '#9F1D35' : '#072D59'};border:1px solid ${
        isDelayed ? '#FD6E88' : '#B8E2F8'
      };">${isDelayed ? `DELAYED (+${etaEval.delay_hours}h)` : sh.status}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:#1E293B;">${origin.city} (${origin.code}) → ${dest.city} (${dest.code})</div>
        <div style="font-size:11.5px;color:#4B5C78;margin-top:2px;">${sh.mode} · ${
        carrier ? carrier.name : 'Assigned Carrier'
      }</div>
        <div style="font-size:11.5px;color:#4B5C78;">Ref: ${sh.vehicle_ref}</div>
        <div style="font-size:11.5px;color:#1E293B;margin-top:6px;padding-top:6px;border-top:1px solid #E3E9F3;">
          <div><strong>Current Checkpoint:</strong> ${currentLocationLabel}</div>
          <div><strong>Distance:</strong> approx. ${distKm.toLocaleString()} km</div>
          <div><strong>ETA:</strong> ${new Date(sh.estimated_arrival).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })} UTC</div>
        </div>
      `;

      if (onSelectRef.current) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Open Timeline & Details →';
        btn.style.cssText =
          'margin-top:8px;width:100%;padding:6px 10px;background:#072D59;color:#FFFFFF;border-radius:6px;font-size:11.5px;font-weight:600;border:none;cursor:pointer;';
        btn.onclick = () => {
          onSelectRef.current?.(sh);
        };
        popupContainer.appendChild(btn);
      }

      marker.bindPopup(popupContainer);
      marker.addTo(layerGroup);
    });

    if (boundsPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [45, 45], maxZoom: 6 });
    }
  }, [
    layerVisibleShipments,
    locations,
    carriers,
    trackingEvents,
    settings,
    selectedShipmentId,
    showHubs,
    visibleModes,
  ]);

  const modeLayerMeta: Array<{
    mode: TransportMode;
    label: string;
    sublabel: string;
    colorHex: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      mode: TransportMode.SEA,
      label: 'Sea Routes (SEA)',
      sublabel: 'Ocean vessels & seaports',
      colorHex: '#072D59',
      icon: Anchor,
    },
    {
      mode: TransportMode.AIR,
      label: 'Air Routes (AIR)',
      sublabel: 'Cargo flights & airports',
      colorHex: '#3E6FB4',
      icon: Plane,
    },
    {
      mode: TransportMode.ROAD,
      label: 'Road Routes (ROAD)',
      sublabel: 'HGV trucks & inland depots',
      colorHex: '#2F8F9A',
      icon: Truck,
    },
  ];

  return (
    <div className="relative isolate z-0 w-full rounded-xl overflow-hidden border border-[#CBD5E1] bg-[#DBF2FC] shadow-2xs">
      <div
        ref={mapContainerRef}
        data-testid="cargotrace-leaflet-map"
        className={`w-full ${heightClass}`}
      />

      {/* LAYER TOGGLE PANEL (Top-Right GIS Overlay Control) */}
      <aside
        aria-label="Map Layer Toggle Panel"
        data-testid="map-layer-toggle-panel"
        className="absolute top-3 right-3 z-[400] w-[296px] bg-white/98 border border-[#CBD5E1] rounded-xl shadow-md overflow-hidden select-none"
      >
        {/* Panel Header */}
        <div className="px-3.5 py-2.5 bg-[#F4F7FB] border-b border-[#E3E9F3] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#072D59] text-[#DBF2FC] flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[12.5px] font-bold text-[#072D59] leading-tight">
                Layer Toggle
              </div>
              <div className="text-[11px] text-[#4B5C78] font-mono-tabular">
                {layerVisibleShipments.length} of {shipments.length} routes shown
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isCustomFiltered && (
              <button
                type="button"
                onClick={resetAllLayers}
                title="Reset all map layers"
                aria-label="Reset all map layers"
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#DBF2FC] text-[#072D59] hover:bg-[#B8E2F8] inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsPanelCollapsed((c) => !c)}
              aria-label={isPanelCollapsed ? 'Expand layer toggle panel' : 'Collapse layer toggle panel'}
              className="p-1 rounded-md text-[#4B5C78] hover:text-[#072D59] hover:bg-[#E3E9F3]/60 transition-colors"
            >
              {isPanelCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Panel Body */}
        {!isPanelCollapsed && (
          <div className="p-2.5 space-y-1.5">
            <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-[#4B5C78]">
              Transport Mode Corridors
            </div>

            {modeLayerMeta.map(({ mode, label, sublabel, colorHex, icon: Icon }) => {
              const isChecked = visibleModes[mode];
              const count = layerCounts[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  aria-label={`Toggle ${label}`}
                  data-testid={`layer-toggle-${mode.toLowerCase()}`}
                  onClick={() => toggleModeLayer(mode)}
                  className={`w-full px-2.5 py-2 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                    isChecked
                      ? 'bg-[#F8FAFC] border-[#CBD5E1] hover:border-[#072D59]'
                      : 'bg-white border-[#E3E9F3] opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Custom Checkbox / Visibility Indicator */}
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-[#072D59] border-[#072D59] text-white'
                          : 'bg-white border-[#94A3B8] text-transparent'
                      }`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>

                    {/* Mode Icon & Swatch */}
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: colorHex }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>

                    <div className="truncate">
                      <div className="text-[12px] font-bold text-[#072D59] leading-tight truncate">
                        {label}
                      </div>
                      <div className="text-[10.5px] text-[#4B5C78] truncate">
                        {sublabel}
                      </div>
                    </div>
                  </div>

                  {/* Shipment Count Badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono-tabular font-bold ${
                        isChecked
                          ? 'bg-[#DBF2FC] text-[#072D59]'
                          : 'bg-[#F1F5F9] text-[#64748B]'
                      }`}
                    >
                      {count}
                    </span>
                    {isChecked ? (
                      <Eye className="w-3.5 h-3.5 text-[#072D59]" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-[#94A3B8]" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* Secondary Overlays Divider */}
            <div className="pt-1.5 mt-1.5 border-t border-[#E3E9F3] space-y-1">
              <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-[#4B5C78]">
                Infrastructure & Risk Overlays
              </div>

              {/* Toggle Logistics Hubs */}
              <button
                type="button"
                role="switch"
                aria-checked={showHubs}
                data-testid="layer-toggle-hubs"
                onClick={() => setShowHubs((h) => !h)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                  showHubs
                    ? 'bg-[#F8FAFC] border-[#CBD5E1]'
                    : 'bg-white border-[#E3E9F3] opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#072D59]" />
                  <span className="text-[11.5px] font-semibold text-[#1E293B]">
                    Ports, Airports & Depots
                  </span>
                </div>
                <span className="text-[11px] font-mono-tabular font-bold text-[#072D59]">
                  {showHubs ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Toggle Delayed Shipments Only */}
              <button
                type="button"
                role="switch"
                aria-checked={delayedOnly}
                data-testid="layer-toggle-delayed-only"
                onClick={() => setDelayedOnly((d) => !d)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                  delayedOnly
                    ? 'bg-[#FFF0F3] border-[#FD6E88]'
                    : 'bg-white border-[#E3E9F3] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#FD6E88]" />
                  <span className="text-[11.5px] font-semibold text-[#9F1D35]">
                    Delayed Routes Only
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-mono-tabular font-bold ${
                    delayedOnly
                      ? 'bg-[#FD6E88] text-white'
                      : 'bg-[#FFF0F3] text-[#9F1D35]'
                  }`}
                >
                  {layerCounts.delayed}
                </span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Empty Layer State Notice (if user turned off all modes) */}
      {layerVisibleShipments.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/98 border border-[#072D59] rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-3 text-[12.5px] text-[#072D59]">
          <span className="font-semibold">
            No routes match the active map layers.
          </span>
          <button
            type="button"
            onClick={resetAllLayers}
            className="px-2.5 py-1 rounded-lg bg-[#072D59] text-white text-[11.5px] font-semibold hover:bg-[#051F3E]"
          >
            Show All Layers
          </button>
        </div>
      )}

      {/* Bottom-Left Map Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 border border-[#CBD5E1] rounded-lg px-3 py-2 shadow-sm flex flex-wrap items-center gap-3.5 text-[11.5px] text-[#1E293B]">
        <span className="font-bold text-[#072D59]">WGS84 Route Legend:</span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 h-1 rounded-full bg-[#072D59]" />
          SEA
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 h-1 rounded-full bg-[#3E6FB4]" />
          AIR
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 h-1 rounded-full bg-[#2F8F9A]" />
          ROAD
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-[#9F1D35]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FD6E88]" />
          Delayed / Hold
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DBF2FC] border-2 border-[#072D59]" />
          Hub Node
        </span>
      </div>
    </div>
  );
};
