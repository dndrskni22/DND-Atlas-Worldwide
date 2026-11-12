import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
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
import {
  DEFAULT_MAP_INTERACTIVITY_OPTIONS,
  EtaService,
  calculateHaversineKm,
  computeCompassIndicatorState,
  formatEnumLabel,
} from '../services/CargoTraceService';
import { VEHICLE_PHOTO_BY_MODE } from './CargoTraceUI';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RotateCw,
  MapPin,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Compass,
  Plus,
  Minus,
  X,
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

type OsmTileStyle = 'osm_standard' | 'osm_humanitarian';

const OSM_TILE_URLS: Record<OsmTileStyle, { tiles: string[]; label: string }> = {
  osm_standard: {
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    label: 'OSM Standard',
  },
  osm_humanitarian: {
    tiles: [
      'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    ],
    label: 'OSM Humanitarian',
  },
};

interface OverlayRouteItem {
  key: string;
  representative: Shipment;
  origin: Location;
  dest: Location;
  carrier?: Carrier;
  mode: TransportMode;
  color: string;
  isDelayed: boolean;
  isSelected: boolean;
  corridorCount: number;
  currentLocationLabel: string;
  distKm: number;
  lngLatCoords: [number, number][];
  vehicleLngLat: [number, number];
}

interface OverlayHubItem {
  id: number;
  code: string;
  name: string;
  city: string;
  country: string;
  typeLabel: string;
  lng: number;
  lat: number;
  color: string;
}

/**
 * Checks whether a [lng, lat] point is on the visible front hemisphere of the 3D Globe
 * relative to the current camera center [centerLng, centerLat].
 */
function isPointVisibleOnFrontHemisphere(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
  maxAngleDeg = 88
): boolean {
  const toRad = Math.PI / 180;
  const lat1 = centerLat * toRad;
  const lat2 = lat * toRad;
  const dLng = (lng - centerLng) * toRad;
  const cosAngle =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const clamped = Math.max(-1, Math.min(1, cosAngle));
  const angleDeg = Math.acos(clamped) * (180 / Math.PI);
  return angleDeg <= maxAngleDeg;
}

/**
 * Interpolates a smooth Quadratic Bezier curve between p0 and p2 ([lat, lng]) using control point p1.
 */
function sampleQuadraticBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  steps = 24
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const lat = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const lng = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    pts.push([lat, lng]);
  }
  return pts;
}

/**
 * Interpolates a smooth multi-waypoint chain ([lat, lng][]) by rounding corners with Quadratic Bezier arcs.
 */
function smoothWaypointChain(waypoints: [number, number][], stepsPerSegment = 10): [number, number][] {
  if (waypoints.length <= 2) {
    if (waypoints.length < 2) return waypoints;
    const [a, b] = waypoints;
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return sampleQuadraticBezier(a, mid, b, 16);
  }

  const result: [number, number][] = [waypoints[0]];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const pStart: [number, number] =
      i === 0
        ? waypoints[0]
        : [
            (waypoints[i - 1][0] + waypoints[i][0]) / 2,
            (waypoints[i - 1][1] + waypoints[i][1]) / 2,
          ];
    const pCtrl = waypoints[i];
    const pEnd: [number, number] =
      i === waypoints.length - 2
        ? waypoints[waypoints.length - 1]
        : [
            (waypoints[i][0] + waypoints[i + 1][0]) / 2,
            (waypoints[i][1] + waypoints[i + 1][1]) / 2,
          ];

    if (i === 0) {
      result.push(pEnd);
    } else {
      const seg = sampleQuadraticBezier(pStart, pCtrl, pEnd, stepsPerSegment);
      result.push(...seg.slice(1));
    }
  }
  return result;
}

/**
 * Generates a realistic, mode-tailored curved trajectory between origin and destination.
 */
function buildModeCurvedTrajectory(
  sh: Shipment,
  origin: Location,
  dest: Location
): {
  latLngCoords: [number, number][];
  lngLatCoords: [number, number][];
  vehicleLatLng: [number, number];
  vehicleLngLat: [number, number];
} {
  const start: [number, number] = [origin.latitude, origin.longitude];
  const end: [number, number] = [dest.latitude, dest.longitude];
  const dLat = end[0] - start[0];
  const dLng = end[1] - start[1];
  const distDeg = Math.hypot(dLat, dLng) || 1;

  const laneSpread = ((sh.id % 3) - 1) * 0.55;
  let latLngCoords: [number, number][] = [];

  if (sh.mode === TransportMode.SEA) {
    const isAsiaToEurope = start[1] > 90 && end[1] < 20;
    const isEuropeToAsia = start[1] < 20 && end[1] > 90;

    if (isAsiaToEurope || isEuropeToAsia) {
      const seaLaneWaypoints: [number, number][] = [
        [1.25 + laneSpread * 0.2, 103.5], // Singapore / Malacca Strait
        [5.6 + laneSpread * 0.3, 80.2],   // South of Sri Lanka (Indian Ocean)
        [12.6 + laneSpread * 0.25, 45.0], // Gulf of Aden / Bab-el-Mandeb
        [27.8 + laneSpread * 0.2, 34.0],  // Red Sea / Suez approach
        [35.5 + laneSpread * 0.25, 18.0], // Central Mediterranean Sea
        [36.0 + laneSpread * 0.15, -5.4], // Strait of Gibraltar
        [48.5 + laneSpread * 0.2, -4.8],  // Bay of Biscay / Ushant
      ];
      const orderedWaypoints = isAsiaToEurope
        ? [start, ...seaLaneWaypoints, end]
        : [start, ...seaLaneWaypoints.reverse(), end];
      latLngCoords = smoothWaypointChain(orderedWaypoints, 10);
    } else {
      const perpLat = -dLng / distDeg;
      const perpLng = dLat / distDeg;
      const arcMagnitude = Math.min(7, Math.max(2.0, distDeg * 0.22)) + laneSpread * 0.4;
      const ctrl: [number, number] = [
        (start[0] + end[0]) / 2 - Math.abs(perpLat) * arcMagnitude,
        (start[1] + end[1]) / 2 + perpLng * arcMagnitude * 0.6,
      ];
      latLngCoords = sampleQuadraticBezier(start, ctrl, end, 22);
    }
  } else if (sh.mode === TransportMode.AIR) {
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    const northernLift = Math.min(18, Math.max(4.5, Math.abs(dLng) * 0.18)) + laneSpread * 0.5;
    const ctrl: [number, number] = [midLat + northernLift, midLng];
    latLngCoords = sampleQuadraticBezier(start, ctrl, end, 26);
  } else {
    const perpLat = -dLng / distDeg;
    const perpLng = dLat / distDeg;
    const roadArc = Math.min(4.0, Math.max(0.8, distDeg * 0.15)) + laneSpread * 0.3;
    const ctrl: [number, number] = [
      (start[0] + end[0]) / 2 + perpLat * roadArc,
      (start[1] + end[1]) / 2 + perpLng * roadArc,
    ];
    latLngCoords = sampleQuadraticBezier(start, ctrl, end, 18);
  }

  const lngLatCoords: [number, number][] = latLngCoords.map(([lat, lng]) => [lng, lat]);

  let progressT = 0.52;
  if (sh.status === ShipmentStatus.CREATED) progressT = 0.12;
  else if (sh.status === ShipmentStatus.BOOKED) progressT = 0.24;
  else if (sh.status === ShipmentStatus.PICKED_UP) progressT = 0.36;
  else if (sh.status === ShipmentStatus.IN_TRANSIT) {
    progressT = 0.42 + ((sh.id % 5) * 0.08);
  } else if (sh.status === ShipmentStatus.DELIVERED) {
    progressT = 0.88;
  }

  const idx = Math.min(
    latLngCoords.length - 1,
    Math.max(0, Math.round(progressT * (latLngCoords.length - 1)))
  );

  const vehicleLatLng = latLngCoords[idx] || start;
  const vehicleLngLat: [number, number] = [vehicleLatLng[1], vehicleLatLng[0]];

  return {
    latLngCoords,
    lngLatCoords,
    vehicleLatLng,
    vehicleLngLat,
  };
}

export const CargoTraceLeafletMap: React.FC<CargoTraceLeafletMapProps> = ({
  shipments,
  locations,
  carriers,
  trackingEvents,
  settings,
  selectedShipmentId = null,
  onSelectShipment,
  heightClass = 'h-[560px]',
  compactControlDefault = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compassDialSvgRef = useRef<SVGSVGElement | null>(null);
  const markerNodesRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const glMapRef = useRef<maplibregl.Map | null>(null);

  const overlayRoutesRef = useRef<OverlayRouteItem[]>([]);
  const overlayHubsRef = useRef<OverlayHubItem[]>([]);
  const isGlobeRef = useRef<boolean>(true);

  // Fallback Leaflet refs in case WebGL is unavailable
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletLayerRef = useRef<L.LayerGroup | null>(null);

  // 3D Globe vs 2D Flat Map state (3D Globe ON by default!)
  const [isGlobeProjection, setIsGlobeProjection] = useState<boolean>(true);
  isGlobeRef.current = isGlobeProjection;

  // Current map view orientation (bearing & pitch in degrees) for the Compass Rotation Indicator
  const [viewBearing, setViewBearing] = useState<number>(0);
  const [viewPitch, setViewPitch] = useState<number>(12);

  const [tileStyle, setTileStyle] = useState<OsmTileStyle>('osm_standard');
  const [mapEngineReady, setMapEngineReady] = useState<boolean>(false);
  const [activePopupCorridorKey, setActivePopupCorridorKey] = useState<string | null>(null);
  const [activeHubPopup, setActiveHubPopup] = useState<OverlayHubItem | null>(null);

  // Independent Layer Visibility State (SEA, AIR, ROAD, Hubs, Delayed-Only)
  const [visibleModes, setVisibleModes] = useState<Record<TransportMode, boolean>>({
    [TransportMode.SEA]: true,
    [TransportMode.AIR]: true,
    [TransportMode.ROAD]: true,
  });
  const [showHubs, setShowHubs] = useState<boolean>(true);
  const [delayedOnly, setDelayedOnly] = useState<boolean>(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(compactControlDefault);

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

  // Compute decluttered corridor routes and hub items
  const { computedRoutes, computedHubs } = useMemo(() => {
    const locMap = new Map<number, Location>();
    locations.forEach((l) => locMap.set(l.id, l));

    const carrierMap = new Map<number, Carrier>();
    carriers.forEach((c) => carrierMap.set(c.id, c));

    const nextHubs: OverlayHubItem[] = [];
    if (showHubs) {
      locations.forEach((loc) => {
        const relevantToActiveModes =
          (loc.type === LocationType.SEAPORT &&
            (visibleModes[TransportMode.SEA] || visibleModes[TransportMode.ROAD])) ||
          (loc.type === LocationType.AIRPORT &&
            (visibleModes[TransportMode.AIR] || visibleModes[TransportMode.ROAD])) ||
          (loc.type === LocationType.DEPOT && visibleModes[TransportMode.ROAD]);

        if (!relevantToActiveModes) return;

        const hubColor =
          loc.type === LocationType.SEAPORT
            ? '#072D59'
            : loc.type === LocationType.AIRPORT
            ? '#2563EB'
            : '#0D9488';

        nextHubs.push({
          id: loc.id,
          code: loc.code,
          name: loc.name,
          city: loc.city,
          country: loc.country,
          typeLabel: formatEnumLabel(loc.type),
          lat: loc.latitude,
          lng: loc.longitude,
          color: hubColor,
        });
      });
    }

    const corridorGroups = new Map<string, Shipment[]>();
    layerVisibleShipments.forEach((sh) => {
      const key =
        selectedShipmentId === sh.id
          ? `selected-${sh.id}`
          : `${sh.origin_location_id}-${sh.destination_location_id}-${sh.mode}`;
      const list = corridorGroups.get(key) || [];
      list.push(sh);
      corridorGroups.set(key, list);
    });

    const nextRoutes: OverlayRouteItem[] = [];
    corridorGroups.forEach((groupShipments, key) => {
      const representative =
        groupShipments.find((s) => s.id === selectedShipmentId) ||
        groupShipments.find((s) => s.status === ShipmentStatus.IN_TRANSIT) ||
        groupShipments[0];

      const origin = locMap.get(representative.origin_location_id);
      const dest = locMap.get(representative.destination_location_id);
      if (!origin || !dest) return;

      const carrier = carrierMap.get(representative.carrier_id);
      const etaEval = EtaService.evaluate(
        representative.expected_arrival,
        representative.estimated_arrival,
        settings
      );
      const anyDelayed = groupShipments.some((s) => {
        const ev = EtaService.evaluate(s.expected_arrival, s.estimated_arrival, settings);
        return ev.is_delayed && s.status !== ShipmentStatus.DELIVERED;
      });
      const isDelayed =
        (etaEval.is_delayed && representative.status !== ShipmentStatus.DELIVERED) ||
        anyDelayed;
      const isSelected = groupShipments.some((s) => s.id === selectedShipmentId);

      const { lngLatCoords, vehicleLngLat } = buildModeCurvedTrajectory(
        representative,
        origin,
        dest
      );

      const polyColor = isDelayed
        ? '#FD6E88'
        : representative.mode === TransportMode.SEA
        ? '#072D59'
        : representative.mode === TransportMode.AIR
        ? '#2563EB'
        : '#0D9488';

      const shEvents = trackingEvents
        .filter((ev) => ev.shipment_id === representative.id)
        .sort(
          (a, b) =>
            new Date(a.event_timestamp).getTime() -
            new Date(b.event_timestamp).getTime()
        );
      const latestEvent =
        shEvents.length > 0 ? shEvents[shEvents.length - 1] : null;
      const currentLocationLabel = latestEvent
        ? latestEvent.location_name
        : `${origin.city} → ${dest.city} Corridor`;

      const distKm = calculateHaversineKm(
        origin.latitude,
        origin.longitude,
        dest.latitude,
        dest.longitude
      );

      nextRoutes.push({
        key,
        representative,
        origin,
        dest,
        carrier,
        mode: representative.mode,
        color: polyColor,
        isDelayed,
        isSelected,
        corridorCount: groupShipments.length,
        currentLocationLabel,
        distKm,
        lngLatCoords,
        vehicleLngLat,
      });
    });

    return { computedRoutes: nextRoutes, computedHubs: nextHubs };
  }, [
    locations,
    carriers,
    layerVisibleShipments,
    selectedShipmentId,
    settings,
    trackingEvents,
    showHubs,
    visibleModes,
  ]);

  overlayRoutesRef.current = computedRoutes;
  overlayHubsRef.current = computedHubs;

  /**
   * Synchronized 60 FPS 2D Canvas & Vehicle Marker overlay renderer that projects
   * 3D Globe [lng, lat] coordinates via glMap.project() with horizon culling.
   */
  const drawGlobeOverlayCanvas = useCallback(() => {
    const glMap = glMapRef.current;
    const canvas = overlayCanvasRef.current;
    const container = mapContainerRef.current;
    if (!glMap || !canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const center = glMap.getCenter();
    const isGlobe = isGlobeRef.current;

    // 1. Draw Curved Routes (SEA solid, AIR dashed, ROAD dotted)
    overlayRoutesRef.current.forEach((route) => {
      const coords = route.lngLatCoords;
      if (coords.length < 2) return;

      const drawPass = (isCasing: boolean) => {
        ctx.beginPath();
        let penDown = false;

        for (let i = 0; i < coords.length; i++) {
          const [lng, lat] = coords[i];
          if (isGlobe && !isPointVisibleOnFrontHemisphere(lng, lat, center.lng, center.lat, 88)) {
            penDown = false;
            continue;
          }
          const pt = glMap.project([lng, lat]);
          if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
            penDown = false;
            continue;
          }
          if (!penDown) {
            ctx.moveTo(pt.x, pt.y);
            penDown = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (isCasing) {
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
          ctx.lineWidth = route.isSelected ? 6.5 : 4.6;
        } else {
          if (route.mode === TransportMode.AIR) {
            ctx.setLineDash([8, 5]);
          } else if (route.mode === TransportMode.ROAD) {
            ctx.setLineDash([3, 5]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.strokeStyle = route.color;
          ctx.lineWidth = route.isSelected ? 4.2 : 2.8;
        }
        ctx.stroke();
      };

      drawPass(true);
      drawPass(false);
    });

    // 2. Draw Seaport, Airport, and Depot Hubs
    ctx.setLineDash([]);
    overlayHubsRef.current.forEach((hub) => {
      if (isGlobe && !isPointVisibleOnFrontHemisphere(hub.lng, hub.lat, center.lng, center.lat, 88)) {
        return;
      }
      const pt = glMap.project([hub.lng, hub.lat]);
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#DBF2FC';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = hub.color;
      ctx.stroke();
    });

    ctx.restore();

    // 3. Position Vehicle Photo Markers directly on their curved trajectory points
    overlayRoutesRef.current.forEach((route) => {
      const btn = markerNodesRef.current.get(route.key);
      if (!btn) return;
      const [lng, lat] = route.vehicleLngLat;
      const visible =
        !isGlobe ||
        isPointVisibleOnFrontHemisphere(lng, lat, center.lng, center.lat, 86);
      if (!visible) {
        btn.style.display = 'none';
        return;
      }
      const pt = glMap.project([lng, lat]);
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
        btn.style.display = 'none';
        return;
      }
      btn.style.display = 'flex';
      btn.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
    });

    // 4. Synchronize Compass Dial SVG rotation at 60 FPS with current map bearing
    if (compassDialSvgRef.current) {
      const currentBearing = glMap.getBearing();
      const { needleRotationDeg } = computeCompassIndicatorState(currentBearing, glMap.getPitch());
      compassDialSvgRef.current.style.transform = `rotate(${needleRotationDeg}deg)`;
    }
  }, []);

  // Initialize MapLibre GL 3D Globe (with OpenStreetMap raster tiles & full interactivity)
  useEffect(() => {
    if (!mapContainerRef.current || glMapRef.current || leafletMapRef.current) return;

    const mapInteractivity = {
      scrollWheelZoom: DEFAULT_MAP_INTERACTIVITY_OPTIONS.scrollWheelZoom,
      dragging: DEFAULT_MAP_INTERACTIVITY_OPTIONS.dragging,
      zoomControl: DEFAULT_MAP_INTERACTIVITY_OPTIONS.zoomControl,
      scrollZoom: DEFAULT_MAP_INTERACTIVITY_OPTIONS.scrollZoom,
      dragPan: DEFAULT_MAP_INTERACTIVITY_OPTIONS.dragPan,
      dragRotate: DEFAULT_MAP_INTERACTIVITY_OPTIONS.dragRotate,
      touchZoomRotate: DEFAULT_MAP_INTERACTIVITY_OPTIONS.touchZoomRotate,
      doubleClickZoom: DEFAULT_MAP_INTERACTIVITY_OPTIONS.doubleClickZoom,
      keyboard: DEFAULT_MAP_INTERACTIVITY_OPTIONS.keyboard,
    };

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          projection: { type: 'globe' },
          sources: {
            'osm-raster': {
              type: 'raster',
              tiles: OSM_TILE_URLS.osm_standard.tiles,
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · DND Atlas 3D Globe',
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: 'osm-raster-layer',
              type: 'raster',
              source: 'osm-raster',
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
        center: [52.0, 24.0],
        zoom: compactControlDefault ? 1.55 : 1.78,
        pitch: 12,
        bearing: 0,
        interactive: true,
        scrollZoom: mapInteractivity.scrollZoom,
        dragPan: mapInteractivity.dragPan,
        dragRotate: mapInteractivity.dragRotate,
        touchZoomRotate: mapInteractivity.touchZoomRotate,
        doubleClickZoom: mapInteractivity.doubleClickZoom,
        keyboard: mapInteractivity.keyboard,
        pitchWithRotate: true,
        attributionControl: false,
      });

      // Explicitly ensure all pan, zoom, and rotation handlers are enabled
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
      map.keyboard.enable();

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      const syncOverlay = () => {
        drawGlobeOverlayCanvas();
      };

      const syncOrientationState = () => {
        setViewBearing(map.getBearing());
        setViewPitch(Math.round(map.getPitch()));
        drawGlobeOverlayCanvas();
      };

      map.on('render', syncOverlay);
      map.on('move', syncOverlay);
      map.on('zoom', syncOverlay);
      map.on('rotate', syncOrientationState);
      map.on('pitch', syncOrientationState);
      map.on('moveend', syncOrientationState);
      map.on('resize', syncOverlay);
      map.on('load', syncOrientationState);

      // Click handler for Hub points on the 3D Globe
      map.on('click', (e) => {
        const clickPt = e.point;
        const center = map.getCenter();
        const isGlobe = isGlobeRef.current;

        for (const hub of overlayHubsRef.current) {
          if (
            isGlobe &&
            !isPointVisibleOnFrontHemisphere(hub.lng, hub.lat, center.lng, center.lat, 88)
          ) {
            continue;
          }
          const pt = map.project([hub.lng, hub.lat]);
          const dist = Math.hypot(pt.x - clickPt.x, pt.y - clickPt.y);
          if (dist <= 10) {
            setActiveHubPopup(hub);
            setActivePopupCorridorKey(null);
            return;
          }
        }
      });

      glMapRef.current = map;
      setMapEngineReady(true);

      return () => {
        map.remove();
        glMapRef.current = null;
      };
    } catch {
      // Fallback to Leaflet Canvas if WebGL context cannot be created
      const canvasRenderer = L.canvas({ padding: 0.65 });
      const lMap = L.map(mapContainerRef.current, {
        center: [24.0, 52.0],
        zoom: 3,
        preferCanvas: true,
        renderer: canvasRenderer,
        scrollWheelZoom: mapInteractivity.scrollWheelZoom,
        dragging: mapInteractivity.dragging,
        zoomControl: mapInteractivity.zoomControl,
      });
      lMap.scrollWheelZoom.enable();
      lMap.dragging.enable();
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(lMap);
      const lg = L.layerGroup().addTo(lMap);
      leafletMapRef.current = lMap;
      leafletLayerRef.current = lg;
      setMapEngineReady(true);

      return () => {
        lMap.remove();
        leafletMapRef.current = null;
        leafletLayerRef.current = null;
      };
    }
  }, [compactControlDefault, drawGlobeOverlayCanvas]);

  // Switch between 3D Globe ('globe') and 2D Flat Map ('mercator')
  useEffect(() => {
    const map = glMapRef.current;
    if (!map) return;
    try {
      map.setProjection({ type: isGlobeProjection ? 'globe' : 'mercator' });
      if (isGlobeProjection) {
        map.easeTo({ zoom: Math.min(map.getZoom(), 2.2), pitch: 12, duration: 450 });
        setViewPitch(12);
      } else {
        map.easeTo({ pitch: 0, zoom: Math.max(map.getZoom(), 2.3), duration: 450 });
        setViewPitch(0);
      }
      drawGlobeOverlayCanvas();
    } catch {
      // ignore if style is mid-transition
    }
  }, [isGlobeProjection, mapEngineReady, drawGlobeOverlayCanvas]);

  // Switch OpenStreetMap raster tile style
  useEffect(() => {
    const map = glMapRef.current;
    if (!map) return;
    try {
      const src = map.getSource('osm-raster') as maplibregl.RasterTileSource | undefined;
      if (src && typeof src.setTiles === 'function') {
        src.setTiles(OSM_TILE_URLS[tileStyle].tiles);
      }
    } catch {
      // ignore
    }
  }, [tileStyle, mapEngineReady]);

  // Re-draw canvas & markers whenever computed routes/hubs or selection change
  useEffect(() => {
    if (!mapEngineReady) return;
    drawGlobeOverlayCanvas();

    if (selectedShipmentId && glMapRef.current) {
      const selectedRoute = computedRoutes.find((r) => r.isSelected);
      if (selectedRoute) {
        glMapRef.current.easeTo({
          center: selectedRoute.vehicleLngLat,
          zoom: Math.max(glMapRef.current.getZoom(), 2.6),
          duration: 600,
        });
      }
    }
  }, [mapEngineReady, computedRoutes, computedHubs, selectedShipmentId, drawGlobeOverlayCanvas]);

  const spinGlobeBy = (deltaLng: number) => {
    const map = glMapRef.current;
    if (!map) return;
    const center = map.getCenter();
    map.easeTo({
      center: [center.lng + deltaLng, center.lat],
      duration: 450,
    });
  };

  const rotateMapBy = (deltaBearing: number) => {
    const map = glMapRef.current;
    const nextBearing = (map ? map.getBearing() : viewBearing) + deltaBearing;
    setViewBearing(nextBearing);
    if (compassDialSvgRef.current) {
      const { needleRotationDeg } = computeCompassIndicatorState(nextBearing, viewPitch);
      compassDialSvgRef.current.style.transform = `rotate(${needleRotationDeg}deg)`;
    }
    if (map) {
      map.easeTo({
        bearing: nextBearing,
        duration: 350,
      });
    }
  };

  const resetBearingToNorth = () => {
    const map = glMapRef.current;
    setViewBearing(0);
    setViewPitch(isGlobeProjection ? 12 : 0);
    if (compassDialSvgRef.current) {
      compassDialSvgRef.current.style.transform = 'rotate(0deg)';
    }
    if (map) {
      map.easeTo({
        bearing: 0,
        pitch: isGlobeProjection ? 12 : 0,
        duration: 400,
      });
    }
  };

  const resetGlobeView = () => {
    const map = glMapRef.current;
    setViewBearing(0);
    setViewPitch(isGlobeProjection ? 12 : 0);
    if (compassDialSvgRef.current) {
      compassDialSvgRef.current.style.transform = 'rotate(0deg)';
    }
    if (!map) return;
    map.easeTo({
      center: [52.0, 24.0],
      zoom: compactControlDefault ? 1.55 : 1.78,
      pitch: isGlobeProjection ? 12 : 0,
      bearing: 0,
      duration: 600,
    });
  };

  const compassState = useMemo(
    () => computeCompassIndicatorState(viewBearing, viewPitch),
    [viewBearing, viewPitch]
  );

  const activePopupRoute = useMemo(
    () => computedRoutes.find((r) => r.key === activePopupCorridorKey) || null,
    [computedRoutes, activePopupCorridorKey]
  );

  const modeLayerMeta: Array<{
    mode: TransportMode;
    label: string;
    sublabel: string;
    photo: string;
  }> = [
    {
      mode: TransportMode.SEA,
      label: 'Sea Routes (SEA)',
      sublabel: 'Curved ocean shipping lanes',
      photo: VEHICLE_PHOTO_BY_MODE[TransportMode.SEA],
    },
    {
      mode: TransportMode.AIR,
      label: 'Air Routes (AIR)',
      sublabel: 'Great-circle flight arcs',
      photo: VEHICLE_PHOTO_BY_MODE[TransportMode.AIR],
    },
    {
      mode: TransportMode.ROAD,
      label: 'Road Routes (ROAD)',
      sublabel: 'Overland trucking corridors',
      photo: VEHICLE_PHOTO_BY_MODE[TransportMode.ROAD],
    },
  ];

  return (
    <div
      className="relative isolate z-0 w-full rounded-xl overflow-hidden border border-[#CBD5E1] shadow-2xs"
      style={{
        background: isGlobeProjection
          ? 'radial-gradient(circle at 50% 50%, #103766 0%, #071D3B 58%, #030D1E 100%)'
          : '#DBF2FC',
      }}
    >
      {/* 3D GLOBE / OPENSTREETMAP CONTAINER */}
      <div
        ref={mapContainerRef}
        data-testid="cargotrace-leaflet-map"
        className={`w-full ${heightClass}`}
      />

      {/* SYNCHRONIZED 60 FPS CURVED ROUTE & HUB OVERLAY CANVAS */}
      <canvas
        ref={overlayCanvasRef}
        className="pointer-events-none absolute inset-0 z-[10]"
      />

      {/* PIXEL-LOCKED VEHICLE PHOTO MARKERS ON THE 3D GLOBE */}
      <div className="pointer-events-none absolute inset-0 z-[20] overflow-hidden">
        {computedRoutes.map((route) => {
          const photoUrl = VEHICLE_PHOTO_BY_MODE[route.mode];
          const modeTag =
            route.mode === TransportMode.SEA
              ? 'SEA'
              : route.mode === TransportMode.AIR
              ? 'AIR'
              : 'ROAD';
          const badgeText =
            route.corridorCount > 1 ? `${modeTag} · ${route.corridorCount}` : modeTag;

          return (
            <button
              key={route.key}
              ref={(el) => {
                if (el) {
                  markerNodesRef.current.set(route.key, el);
                } else {
                  markerNodesRef.current.delete(route.key);
                }
              }}
              type="button"
              onClick={() => {
                setActivePopupCorridorKey((prev) =>
                  prev === route.key ? null : route.key
                );
                setActiveHubPopup(null);
              }}
              title={`${route.representative.shipment_number} · ${route.origin.city} → ${route.dest.city}`}
              className="pointer-events-auto absolute top-0 left-0 rounded-lg bg-white overflow-hidden cursor-pointer flex items-center justify-center shadow-md transition-shadow hover:scale-105"
              style={{
                width: route.isSelected ? '54px' : '46px',
                height: route.isSelected ? '35px' : '30px',
                border: `${route.isSelected ? '3px' : '2px'} solid ${route.color}`,
                boxShadow: '0 4px 12px rgba(7,45,89,0.42)',
                display: 'none',
              }}
            >
              <img
                src={photoUrl}
                alt={modeTag}
                className="w-full h-full object-cover block"
              />
              <span
                className="absolute bottom-[1px] right-[2px] text-[8px] font-extrabold px-1 rounded-[3px] text-white leading-tight tracking-tight"
                style={{ backgroundColor: route.color }}
              >
                {badgeText}
              </span>
            </button>
          );
        })}
      </div>

      {/* FLOATING SHIPMENT INSPECTION POPUP ON THE 3D GLOBE */}
      {activePopupRoute && (
        <div
          data-testid="globe-shipment-popup"
          className="absolute bottom-14 left-3 z-[410] w-[300px] bg-white border border-[#CBD5E1] rounded-xl p-3.5 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={VEHICLE_PHOTO_BY_MODE[activePopupRoute.mode]}
                alt={activePopupRoute.mode}
                className="w-14 h-9.5 object-cover rounded-md border border-[#CBD5E1] shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-bold text-[#072D59]">
                    {activePopupRoute.representative.shipment_number}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      activePopupRoute.isDelayed
                        ? 'bg-[#FFF0F3] text-[#9F1D35]'
                        : 'bg-[#DBF2FC] text-[#072D59]'
                    }`}
                  >
                    {activePopupRoute.isDelayed
                      ? 'Delayed'
                      : formatEnumLabel(activePopupRoute.representative.status)}
                  </span>
                </div>
                <div className="text-[11.5px] font-semibold text-[#334155] truncate">
                  {activePopupRoute.carrier?.name || 'Assigned Carrier'}
                </div>
                <div className="text-[10.5px] text-[#64748B] truncate">
                  {activePopupRoute.representative.vehicle_ref}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePopupCorridorKey(null)}
              aria-label="Close popup"
              className="p-1 rounded-md text-[#64748B] hover:text-[#072D59] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[12.5px] font-bold text-[#072D59]">
            {activePopupRoute.origin.city} ({activePopupRoute.origin.code}) →{' '}
            {activePopupRoute.dest.city} ({activePopupRoute.dest.code})
          </div>
          <div className="text-[11.5px] text-[#334155] mt-1.5 pt-1.5 border-t border-[#E3E9F3] space-y-0.5">
            <div>
              <strong>Checkpoint:</strong> {activePopupRoute.currentLocationLabel}
            </div>
            <div>
              <strong>Corridor Volume:</strong> {activePopupRoute.corridorCount} active
              shipment(s) · {activePopupRoute.distKm.toLocaleString()} km
            </div>
            <div>
              <strong>ETA:</strong>{' '}
              {new Date(
                activePopupRoute.representative.estimated_arrival
              ).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              UTC
            </div>
          </div>

          {onSelectShipment && (
            <button
              type="button"
              onClick={() => onSelectShipment(activePopupRoute.representative)}
              className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white text-[11.5px] font-semibold cursor-pointer transition-colors"
            >
              Inspect {activePopupRoute.representative.shipment_number} Details →
            </button>
          )}
        </div>
      )}

      {/* FLOATING HUB POPUP ON THE 3D GLOBE */}
      {activeHubPopup && (
        <div
          data-testid="globe-hub-popup"
          className="absolute bottom-14 left-3 z-[410] w-[250px] bg-white border border-[#CBD5E1] rounded-xl p-3 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10.5px] font-bold uppercase text-[#4B5C78]">
                {activeHubPopup.typeLabel} · {activeHubPopup.code}
              </div>
              <div className="text-[13px] font-bold text-[#072D59] mt-0.5">
                {activeHubPopup.name}
              </div>
              <div className="text-[11.5px] text-[#243350]">
                {activeHubPopup.city}, {activeHubPopup.country}
              </div>
              <div className="text-[11px] font-mono text-[#4B5C78] mt-1">
                WGS84: {activeHubPopup.lat.toFixed(4)}, {activeHubPopup.lng.toFixed(4)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveHubPopup(null)}
              aria-label="Close hub popup"
              className="p-1 rounded-md text-[#64748B] hover:text-[#072D59] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TOP-LEFT: 3D GLOBE & OPENSTREETMAP CONTROL BAR */}
      <div
        data-testid="map-3d-control-bar"
        className="absolute top-3 left-3 z-[400] bg-white/96 border border-[#CBD5E1] rounded-xl p-1.5 shadow-md flex flex-wrap items-center gap-1.5 select-none"
      >
        {/* Zoom In / Out */}
        <div className="flex items-center gap-0.5 pr-1.5 border-r border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => {
              glMapRef.current?.zoomIn({ duration: 250 });
              leafletMapRef.current?.zoomIn();
            }}
            aria-label="Zoom in"
            className="w-7 h-7 rounded-lg bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#072D59] flex items-center justify-center cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              glMapRef.current?.zoomOut({ duration: 250 });
              leafletMapRef.current?.zoomOut();
            }}
            aria-label="Zoom out"
            className="w-7 h-7 rounded-lg bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#072D59] flex items-center justify-center cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3D Globe vs 2D Map Toggle */}
        <button
          type="button"
          onClick={() => setIsGlobeProjection((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-[11.5px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
            isGlobeProjection
              ? 'bg-[#072D59] text-white shadow-xs'
              : 'bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]'
          }`}
          title="Switch between 3D Earth Globe and 2D Flat OpenStreetMap"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{isGlobeProjection ? '3D Globe (OSM)' : '2D Flat Map'}</span>
        </button>

        {/* Spin / Orbit Globe Controls */}
        <div className="flex items-center gap-1 border-l border-[#E2E8F0] pl-1.5">
          <button
            type="button"
            onClick={() => spinGlobeBy(-28)}
            className="px-2 py-1 rounded-md text-[11px] font-bold bg-[#F8FAFC] text-[#072D59] hover:bg-[#E2E8F0] cursor-pointer"
            title="Spin Globe West (Europe / Atlantic)"
          >
            ◀ Spin West
          </button>
          <button
            type="button"
            onClick={resetGlobeView}
            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#DBF2FC] text-[#072D59] hover:bg-[#B8E2F8] inline-flex items-center gap-1 cursor-pointer"
            title="Center Globe on Southeast Asia → Europe Corridor"
          >
            <Compass className="w-3 h-3" />
            <span>Center Corridor</span>
          </button>
          <button
            type="button"
            onClick={() => spinGlobeBy(28)}
            className="px-2 py-1 rounded-md text-[11px] font-bold bg-[#F8FAFC] text-[#072D59] hover:bg-[#E2E8F0] cursor-pointer"
            title="Spin Globe East (Asia-Pacific)"
          >
            Spin East ▶
          </button>
        </div>

        {/* OpenStreetMap Tile Switcher */}
        <div className="flex items-center gap-1 border-l border-[#E2E8F0] pl-1.5">
          {(['osm_standard', 'osm_humanitarian'] as OsmTileStyle[]).map((styleKey) => (
            <button
              key={styleKey}
              type="button"
              onClick={() => setTileStyle(styleKey)}
              className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer ${
                tileStyle === styleKey
                  ? 'bg-[#DBF2FC] text-[#072D59] font-bold'
                  : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              {OSM_TILE_URLS[styleKey].label}
            </button>
          ))}
        </div>
      </div>

      {/* LAYER TOGGLE PANEL (Top-Right GIS Overlay Control) */}
      <aside
        aria-label="Map Layer Toggle Panel"
        data-testid="map-layer-toggle-panel"
        className="absolute top-3 right-3 z-[400] w-[304px] bg-white/98 border border-[#CBD5E1] rounded-xl shadow-md overflow-hidden select-none"
      >
        <div className="px-3.5 py-2.5 bg-[#F4F7FB] border-b border-[#E3E9F3] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#072D59] text-[#DBF2FC] flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[12.5px] font-bold text-[#072D59] leading-tight">
                Layer Toggle
              </div>
              <div className="text-[11px] text-[#4B5C78] tabular-nums">
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

        {!isPanelCollapsed && (
          <div className="p-2.5 space-y-1.5">
            <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-[#4B5C78]">
              Transport Mode Corridors
            </div>

            {modeLayerMeta.map(({ mode, label, sublabel, photo }) => {
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

                    <img
                      src={photo}
                      alt={label}
                      className="w-10 h-6.5 rounded object-cover border border-[#CBD5E1] shrink-0 bg-white"
                    />

                    <div className="truncate">
                      <div className="text-[12px] font-bold text-[#072D59] leading-tight truncate">
                        {label}
                      </div>
                      <div className="text-[10.5px] text-[#4B5C78] truncate">
                        {sublabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums font-bold ${
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

            <div className="pt-1.5 mt-1.5 border-t border-[#E3E9F3] space-y-1">
              <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-[#4B5C78]">
                Infrastructure & Risk Overlays
              </div>

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
                <span className="text-[11px] tabular-nums font-bold text-[#072D59]">
                  {showHubs ? 'ON' : 'OFF'}
                </span>
              </button>

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
                  className={`px-1.5 py-0.5 rounded text-[10.5px] tabular-nums font-bold ${
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

      {layerVisibleShipments.length === 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[400] bg-white/98 border border-[#072D59] rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-3 text-[12.5px] text-[#072D59]">
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

      {/* COMPASS ROTATION INDICATOR (Bottom-Right Orientation & View Angle Widget) */}
      <div
        data-testid="map-compass-indicator"
        role="region"
        aria-label="Compass rotation indicator"
        className="absolute bottom-10 right-3 z-[400] bg-white/96 border border-[#CBD5E1] rounded-xl p-2 shadow-md flex flex-col items-center gap-1.5 select-none"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="compass-rotate-ccw"
            onClick={() => rotateMapBy(-45)}
            aria-label="Rotate map counter-clockwise 45 degrees"
            title="Rotate View Angle -45° (Counter-Clockwise)"
            className="w-6 h-6 rounded-md bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#072D59] flex items-center justify-center cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="compass-reset-north"
            onClick={resetBearingToNorth}
            aria-label={`Compass orientation ${compassState.formattedLabel}. Click to reset North`}
            title={`Current Bearing: ${compassState.formattedLabel} · Click to reset North (0° N)`}
            className="relative w-12 h-12 rounded-full bg-[#F8FAFC] hover:bg-[#DBF2FC]/50 border border-[#CBD5E1] flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <svg
              ref={compassDialSvgRef}
              data-testid="compass-rose-dial"
              viewBox="0 0 48 48"
              className="w-11 h-11 transition-transform duration-150 ease-out"
              style={{
                transform: `rotate(${compassState.needleRotationDeg}deg)`,
              }}
            >
              {/* Outer degree ring */}
              <circle
                cx="24"
                cy="24"
                r="21"
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />
              {/* Cardinal ticks */}
              <line x1="24" y1="3" x2="24" y2="6.5" stroke="#FD6E88" strokeWidth="2" />
              <line x1="45" y1="24" x2="41.5" y2="24" stroke="#64748B" strokeWidth="1.4" />
              <line x1="24" y1="45" x2="24" y2="41.5" stroke="#072D59" strokeWidth="1.6" />
              <line x1="3" y1="24" x2="6.5" y2="24" stroke="#64748B" strokeWidth="1.4" />

              {/* Cardinal Labels */}
              <text
                x="24"
                y="12.5"
                textAnchor="middle"
                fill="#E11D48"
                fontSize="7.5"
                fontWeight="800"
              >
                N
              </text>
              <text
                x="37.5"
                y="26.5"
                textAnchor="middle"
                fill="#475569"
                fontSize="6.5"
                fontWeight="700"
              >
                E
              </text>
              <text
                x="24"
                y="40"
                textAnchor="middle"
                fill="#072D59"
                fontSize="6.5"
                fontWeight="700"
              >
                S
              </text>
              <text
                x="10.5"
                y="26.5"
                textAnchor="middle"
                fill="#475569"
                fontSize="6.5"
                fontWeight="700"
              >
                W
              </text>

              {/* North Needle (Crimson) */}
              <polygon points="24,13.5 27,24 24,22 21,24" fill="#FD6E88" />
              {/* South Needle (Deep Navy) */}
              <polygon points="24,34.5 27,24 24,26 21,24" fill="#072D59" />
              {/* Center Pivot */}
              <circle cx="24" cy="24" r="2.2" fill="#FFFFFF" stroke="#072D59" strokeWidth="1.4" />
            </svg>
          </button>

          <button
            type="button"
            data-testid="compass-rotate-cw"
            onClick={() => rotateMapBy(45)}
            aria-label="Rotate map clockwise 45 degrees"
            title="Rotate View Angle +45° (Clockwise)"
            className="w-6 h-6 rounded-md bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#072D59] flex items-center justify-center cursor-pointer transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[10.5px] font-mono tabular-nums font-bold text-[#072D59]">
          <span data-testid="compass-bearing-readout">{compassState.formattedLabel}</span>
          {compassState.isRotated && (
            <button
              type="button"
              onClick={resetBearingToNorth}
              className="px-1.5 py-0.2 rounded bg-[#DBF2FC] text-[#072D59] hover:bg-[#B8E2F8] font-sans text-[9.5px] font-bold cursor-pointer"
              title="Reset orientation to True North"
            >
              Reset N
            </button>
          )}
        </div>
      </div>

      {/* Bottom-Left Map Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 border border-[#CBD5E1] rounded-lg px-3 py-2 shadow-sm flex flex-wrap items-center gap-3.5 text-[11.5px] text-[#1E293B]">
        <span className="font-bold text-[#072D59]">
          {isGlobeProjection ? '3D Globe (WebGL OpenStreetMap):' : '2D OpenStreetMap:'}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-4 h-0.5 rounded-full bg-[#072D59]" />
          Sea Lane (Solid Curve)
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-4 h-0.5 border-b-2 border-dashed border-[#2563EB]" />
          Air Arc (Great-Circle)
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-4 h-0.5 border-b-2 border-dotted border-[#0D9488]" />
          Road Corridor
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-[#9F1D35]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FD6E88]" />
          Delayed / Hold
        </span>
      </div>
    </div>
  );
};
