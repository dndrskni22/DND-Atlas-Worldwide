import React, { useEffect, useMemo, useState } from 'react';
import {
  AuditLogEntry,
  Carrier,
  ExceptionStatus,
  ExceptionType,
  GroupConfigSettings,
  Location,
  LocationType,
  ModeEventType,
  NotificationItem,
  RouteVolumeRow,
  SeverityLevel,
  Shipment,
  ShipmentException,
  ShipmentItem,
  ShipmentStatus,
  TrackingEvent,
  TransportMode,
  User,
  UserRole,
  WeatherSnapshot,
} from './types/cargotrace';
import {
  ALL_SEED_SHIPMENTS,
  INITIAL_GROUP_SETTINGS,
  SEED_AUDIT_LOGS,
  SEED_CARRIERS,
  SEED_EXCEPTIONS,
  SEED_LOCATIONS,
  SEED_NOTIFICATIONS,
  SEED_SHIPMENT_ITEMS,
  SEED_TRACKING_EVENTS,
  SEED_USERS,
} from './data/seedCargoTrace';
import {
  AuthPolicyService,
  EtaService,
  ShipmentService,
  TrackingService,
  calculateHaversineKm,
  calculateHaversineMiles,
  formatEnumLabel,
} from './services/CargoTraceService';
import { ExternalApiService } from './services/ExternalApiService';
import {
  DndAtlasBrandMark,
  ExceptionStatusBadge,
  KpiStatCard,
  LocationTypeBadge,
  ModeIconChip,
  SeverityBadge,
  ShipmentStatusBadge,
} from './components/CargoTraceUI';
import { ShipmentsAnalyticsChart } from './components/ShipmentsAnalyticsChart';
import { CargoTraceLeafletMap } from './components/CargoTraceLeafletMap';
import { ShipmentDetailModal } from './components/ShipmentDetailModal';
import { NewShipmentModal } from './components/NewShipmentModal';
import { LoginPage } from './components/LoginPage';
import {
  LayoutGrid,
  Navigation,
  Package,
  MapPin,
  Route,
  CloudSun,
  AlertTriangle,
  Bell,
  History,
  Settings,
  HelpCircle,
  Search,
  Clock,
  Plus,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Anchor,
  Building2,
  ArrowUpDown,
  BookOpen,
  LogOut,
  Trash2,
  Compass,
} from 'lucide-react';

type ActiveSection =
  | 'overview'
  | 'tracking'
  | 'shipments'
  | 'active_routes'
  | 'popular_routes'
  | 'weather'
  | 'exceptions'
  | 'notifications'
  | 'history'
  | 'carriers'
  | 'locations'
  | 'settings'
  | 'code_ownership';

type TimeRangeSegment = '15m' | '1h' | '24h' | '3d' | '7d' | 'all';

const SECTION_LABELS: Record<ActiveSection, string> = {
  overview: 'Logistics Overview',
  tracking: 'Tracking & Timeline',
  shipments: 'Shipments Directory',
  active_routes: 'Active Routes',
  popular_routes: 'Popular Routes',
  weather: 'Hub Weather Forecast',
  exceptions: 'Exceptions & Holds',
  notifications: 'Notifications',
  history: 'Audit Log',
  carriers: 'Carriers & Fleet',
  locations: 'Locations & Hubs',
  settings: 'Configuration',
  code_ownership: 'Architecture Reference',
};

export const App: React.FC = () => {
  const [users] = useState<User[]>(SEED_USERS);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const savedEmail = localStorage.getItem('cargotrace_auth_email');
      if (savedEmail) {
        const found = SEED_USERS.find(
          (u) => u.email.toLowerCase() === savedEmail.toLowerCase()
        );
        if (found) return found;
      }
    } catch {
      // Ignore storage access errors
    }
    return SEED_USERS[1]; // Budiono Siregar (OPERATOR)
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return true;
      if (params.get('login') === '1') return false;
      try {
        const savedEmail = localStorage.getItem('cargotrace_auth_email');
        if (savedEmail && SEED_USERS.some((u) => u.email.toLowerCase() === savedEmail.toLowerCase())) {
          return true;
        }
      } catch {
        // Ignore storage errors
      }
    }
    return false;
  });

  // Navigation & Sidebar
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Core Domain State
  const [settings, setSettings] = useState<GroupConfigSettings>(INITIAL_GROUP_SETTINGS);
  const [shipments, setShipments] = useState<Shipment[]>(ALL_SEED_SHIPMENTS);
  const [shipmentItems] = useState<ShipmentItem[]>(SEED_SHIPMENT_ITEMS);
  const [carriers, setCarriers] = useState<Carrier[]>(SEED_CARRIERS);
  const [locations, setLocations] = useState<Location[]>(SEED_LOCATIONS);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>(SEED_TRACKING_EVENTS);
  const [exceptions, setExceptions] = useState<ShipmentException[]>(SEED_EXCEPTIONS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(SEED_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);

  // Filters & Toolbar State
  const [modeFilter, setModeFilter] = useState<'ALL' | TransportMode>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ShipmentStatus | 'DELAYED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeSegment, setTimeSegment] = useState<TimeRangeSegment>('all');
  const [sortField, setSortField] = useState<'shipment_number' | 'expected_arrival' | 'weight'>('expected_arrival');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals & Drawers
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isNewShipmentOpen, setIsNewShipmentOpen] = useState(false);
  const [trackingLookupInput, setTrackingLookupInput] = useState('DND-2026-000101');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // History / Audit Log Filter State
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<'ALL' | 'SHIPMENT' | 'EXCEPTION' | 'SETTINGS'>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Weather Page State
  const [weatherSnapshots, setWeatherSnapshots] = useState<Record<string, WeatherSnapshot>>({});
  const [loadingWeatherAll, setLoadingWeatherAll] = useState(false);

  // Admin Location & Carrier Forms
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocCountry, setNewLocCountry] = useState('');
  const [newLocType, setNewLocType] = useState<LocationType>(LocationType.SEAPORT);
  const [newLocLat, setNewLocLat] = useState<number>(-6.9482);
  const [newLocLng, setNewLocLng] = useState<number>(110.4239);
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);

  const [newCarrierCode, setNewCarrierCode] = useState('');
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierMode, setNewCarrierMode] = useState<TransportMode>(TransportMode.SEA);
  const [newCarrierFleet, setNewCarrierFleet] = useState('');

  // Server Clock Display
  const [serverClock, setServerClock] = useState('05 Nov 2026, 11:36');
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setServerClock(`${formatted}, ${timeStr}`);
    };
    updateClock();
    const id = setInterval(updateClock, 30000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Load weather when visiting weather tab
  useEffect(() => {
    if (activeSection !== 'weather') return;
    setLoadingWeatherAll(true);
    Promise.all(
      locations.slice(0, 8).map((loc) => ExternalApiService.fetchLocationWeather(loc))
    ).then((snaps) => {
      const next: Record<string, WeatherSnapshot> = {};
      snaps.forEach((s) => {
        next[s.location_code] = s;
      });
      setWeatherSnapshots(next);
      setLoadingWeatherAll(false);
    });
  }, [activeSection, locations]);

  // 1. Role-Scoped Shipments (Server-Side Policy Enforcement: Slide 5 & 13)
  // Customers can NEVER see another customer's shipments
  const roleScopedShipments = useMemo(() => {
    return shipments.filter(
      (sh) => AuthPolicyService.canViewShipment(currentUser, sh).valid
    );
  }, [shipments, currentUser]);

  // 2. Filtered Shipments by Mode, Search, Status, and Time Range Segment
  const filteredShipments = useMemo(() => {
    const anchorMs = new Date('2026-11-05T04:00:00Z').getTime();
    const segmentHoursMap: Record<TimeRangeSegment, number | null> = {
      '15m': 24, // Recent 24h window for operational demo density
      '1h': 48,
      '24h': 72,
      '3d': 120,
      '7d': 240,
      all: null,
    };
    const windowHours = segmentHoursMap[timeSegment];

    const locMap = new Map<number, Location>();
    locations.forEach((l) => locMap.set(l.id, l));
    const carrierMap = new Map<number, Carrier>();
    carriers.forEach((c) => carrierMap.set(c.id, c));

    return roleScopedShipments
      .filter((sh) => {
        if (modeFilter !== 'ALL' && sh.mode !== modeFilter) return false;

        const eta = EtaService.evaluate(
          sh.expected_arrival,
          sh.estimated_arrival,
          settings
        );
        const isDelayed = eta.is_delayed && sh.status !== ShipmentStatus.DELIVERED;

        if (statusFilter === 'DELAYED') {
          if (!isDelayed) return false;
        } else if (statusFilter !== 'ALL' && sh.status !== statusFilter) {
          return false;
        }

        if (windowHours !== null) {
          const updatedMs = new Date(sh.updated_at).getTime();
          const diffHours = Math.abs(anchorMs - updatedMs) / 3600000;
          if (diffHours > windowHours) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim().replace(/^ct-2026-/, 'dnd-2026-');
          const orig = locMap.get(sh.origin_location_id);
          const dest = locMap.get(sh.destination_location_id);
          const car = carrierMap.get(sh.carrier_id);
          const hay = [
            sh.shipment_number,
            sh.route_code,
            sh.customer_name,
            sh.cargo_type,
            sh.vehicle_ref,
            sh.mode,
            orig?.name,
            orig?.city,
            orig?.code,
            dest?.name,
            dest?.city,
            dest?.code,
            car?.name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'shipment_number') {
          cmp = a.shipment_number.localeCompare(b.shipment_number);
        } else if (sortField === 'weight') {
          cmp = a.total_weight_kg - b.total_weight_kg;
        } else {
          cmp =
            new Date(a.expected_arrival).getTime() -
            new Date(b.expected_arrival).getTime();
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [
    roleScopedShipments,
    modeFilter,
    statusFilter,
    timeSegment,
    searchQuery,
    sortField,
    sortAsc,
    locations,
    carriers,
    settings,
  ]);

  // 3. Real Database-Derived KPI Metrics (Slide 10 & image.png)
  const kpiMetrics = useMemo(() => {
    const total = filteredShipments.length;
    const inTransit = filteredShipments.filter(
      (s) => s.status === ShipmentStatus.IN_TRANSIT || s.status === ShipmentStatus.PICKED_UP
    ).length;

    let delayedCount = 0;
    let thresholdExceededCount = 0;
    let onTimeCount = 0;

    filteredShipments.forEach((sh) => {
      const ev = EtaService.evaluate(
        sh.expected_arrival,
        sh.estimated_arrival,
        settings
      );
      if (ev.is_delayed && sh.status !== ShipmentStatus.DELIVERED) {
        delayedCount++;
        if (ev.exceeds_group_threshold) thresholdExceededCount++;
      } else {
        onTimeCount++;
      }
    });

    const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;
    const inTransitRate = total > 0 ? Math.round((inTransit / total) * 100) : 0;
    const delayedRate = total > 0 ? Math.round((delayedCount / total) * 100) : 0;

    const visibleShipmentIds = new Set(filteredShipments.map((s) => s.id));
    const scopedExceptions = exceptions.filter((ex) =>
      visibleShipmentIds.has(ex.shipment_id)
    );
    const openExceptions = scopedExceptions.filter(
      (ex) => ex.status !== ExceptionStatus.RESOLVED
    ).length;
    const totalExceptions = Math.max(1, scopedExceptions.length);
    const openExceptionRate = Math.round((openExceptions / totalExceptions) * 100);

    return {
      total,
      onTimeCount,
      onTimeRate,
      inTransit,
      inTransitRate,
      delayedCount,
      thresholdExceededCount,
      delayedRate,
      openExceptions,
      totalExceptions: scopedExceptions.length,
      openExceptionRate,
    };
  }, [filteredShipments, exceptions, settings]);

  // 4. Aggregated Popular Routes Table (Matching image.png bottom table)
  const popularRoutes = useMemo<RouteVolumeRow[]>(() => {
    const locMap = new Map<number, Location>();
    locations.forEach((l) => locMap.set(l.id, l));
    const carrierMap = new Map<number, Carrier>();
    carriers.forEach((c) => carrierMap.set(c.id, c));

    const groups = new Map<string, Shipment[]>();
    filteredShipments.forEach((sh) => {
      const key = `${sh.origin_location_id}-${sh.destination_location_id}-${sh.mode}`;
      const list = groups.get(key) || [];
      list.push(sh);
      groups.set(key, list);
    });

    const rows: RouteVolumeRow[] = [];
    const seenRouteKeys = new Set<string>();
    groups.forEach((groupShipments) => {
      const first = groupShipments[0];
      const origin = locMap.get(first.origin_location_id);
      const destination = locMap.get(first.destination_location_id);
      const carrier = carrierMap.get(first.carrier_id);
      if (!origin || !destination || !carrier) return;

      const distKm = calculateHaversineKm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );
      const distMi = calculateHaversineMiles(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );

      // Compute average transit days & on-time rate
      let totalDays = 0;
      let onTime = 0;
      let anyDelayed = false;

      groupShipments.forEach((s) => {
        const dep = new Date(s.expected_departure).getTime();
        const arr = new Date(s.estimated_arrival).getTime();
        const days = Math.max(0.2, (arr - dep) / (1000 * 3600 * 24));
        totalDays += days;

        const eta = EtaService.evaluate(s.expected_arrival, s.estimated_arrival, settings);
        if (eta.is_delayed && s.status !== ShipmentStatus.DELIVERED) {
          anyDelayed = true;
        } else {
          onTime++;
        }
      });

      const activeRep =
        groupShipments.find((s) => s.status === ShipmentStatus.IN_TRANSIT) || first;

      const candidateCodeKey = `${first.route_code}-${first.mode}`;
      const uniqueRouteCode = seenRouteKeys.has(candidateCodeKey)
        ? `${first.route_code}-${origin.code}-${destination.code}`
        : first.route_code;
      seenRouteKeys.add(candidateCodeKey);

      rows.push({
        route_code: uniqueRouteCode,
        origin,
        destination,
        carrier,
        vehicle_ref: activeRep.vehicle_ref,
        mode: first.mode,
        mode_label:
          first.mode === TransportMode.SEA
            ? 'Sea To Port'
            : first.mode === TransportMode.AIR
            ? 'Air Express'
            : 'Road To Hub',
        representative_status: activeRep.status,
        is_delayed: anyDelayed,
        distance_km: distKm,
        distance_mi: distMi,
        shipment_count: groupShipments.length,
        avg_transit_days: Number((totalDays / groupShipments.length).toFixed(1)),
        on_time_rate: Math.round((onTime / groupShipments.length) * 100),
        sample_shipment_id: activeRep.id,
        sample_shipment_number: activeRep.shipment_number,
      });
    });

    return rows.sort((a, b) => b.shipment_count - a.shipment_count);
  }, [filteredShipments, locations, carriers, settings]);

  // Handlers for Creating Shipment, Adding Event, Reporting/Resolving Exception
  const handleCreateShipment = (payload: {
    mode: TransportMode;
    customer_id: number;
    carrier_id: number;
    origin_location_id: number;
    destination_location_id: number;
    vehicle_ref: string;
    cargo_type: string;
    total_weight_kg: number;
    total_volume_cbm: number;
    expected_departure: string;
    expected_arrival: string;
  }) => {
    const authCheck = AuthPolicyService.canMutateShipment(currentUser);
    if (!authCheck.valid) {
      return {
        valid: false,
        status_code: authCheck.status_code,
        message: authCheck.message,
        errors: authCheck.errors,
      };
    }

    const carrier = carriers.find((c) => c.id === payload.carrier_id);
    const origin = locations.find((l) => l.id === payload.origin_location_id);
    const destination = locations.find((l) => l.id === payload.destination_location_id);
    const customer = users.find((u) => u.id === payload.customer_id);

    const validation = ShipmentService.validateShipmentPayload({
      mode: payload.mode,
      carrier,
      origin,
      destination,
      cargo_type: payload.cargo_type,
      total_weight_kg: payload.total_weight_kg,
      total_volume_cbm: payload.total_volume_cbm,
      expected_departure: payload.expected_departure,
      expected_arrival: payload.expected_arrival,
    });

    if (!validation.valid) {
      return validation;
    }

    const nextId = Math.max(...shipments.map((s) => s.id)) + 1;
    const shipmentNumber = `DND-2026-000${nextId}`;
    const nowIso = new Date().toISOString();

    const newShipment: Shipment = {
      id: nextId,
      shipment_number: shipmentNumber,
      route_code: `RT-0${origin?.id || 1}${destination?.id || 2}`,
      customer_id: payload.customer_id,
      customer_name: customer?.company_name || 'PT Nusantara Retail',
      carrier_id: payload.carrier_id,
      mode: payload.mode,
      vehicle_ref: payload.vehicle_ref,
      origin_location_id: payload.origin_location_id,
      destination_location_id: payload.destination_location_id,
      cargo_type: payload.cargo_type,
      total_weight_kg: payload.total_weight_kg,
      total_volume_cbm: payload.total_volume_cbm,
      expected_departure: payload.expected_departure,
      expected_arrival: payload.expected_arrival,
      estimated_arrival: payload.expected_arrival,
      actual_arrival: null,
      status: ShipmentStatus.CREATED,
      created_at: nowIso,
      updated_at: nowIso,
    };

    setShipments((prev) => [newShipment, ...prev]);

    // Record initial append-only tracking event
    if (origin) {
      const initEv: TrackingEvent = {
        id: Date.now(),
        shipment_id: nextId,
        event_type: 'STATUS_CHANGE',
        status_after: ShipmentStatus.CREATED,
        event_timestamp: payload.expected_departure,
        location_id: origin.id,
        location_name: `${origin.name} (${origin.city})`,
        latitude: origin.latitude,
        longitude: origin.longitude,
        description: `Shipment ${shipmentNumber} registered (${payload.mode}) via ${carrier?.name}.`,
        is_exception: false,
        created_by_user_id: currentUser.id,
        created_by_name: currentUser.name,
      };
      setTrackingEvents((prev) => [...prev, initEv]);
    }

    // Record Audit Log
    setAuditLogs((prev) => [
      {
        id: Date.now() + 1,
        actor_user_id: currentUser.id,
        actor_name: currentUser.name,
        actor_role: currentUser.role,
        action: 'SHIPMENT_CREATED',
        entity_type: 'Shipment',
        entity_id: shipmentNumber,
        summary: `Created ${payload.mode} shipment ${shipmentNumber} (${origin?.code} → ${destination?.code}).`,
        old_values: null,
        new_values: { mode: payload.mode, status: 'CREATED', carrier: carrier?.code },
        created_at: nowIso,
      },
      ...prev,
    ]);

    showToast(`Shipment ${shipmentNumber} created in CREATED status.`);
    setSelectedShipment(newShipment);
    return validation;
  };

  const handleAddTrackingEvent = (payload: {
    shipment_id: number;
    event_type: ModeEventType;
    status_after: ShipmentStatus | null;
    event_timestamp: string;
    location_id: number | null;
    location_name: string;
    latitude: number;
    longitude: number;
    description: string;
    revised_eta?: string;
  }) => {
    const targetShipment = shipments.find((s) => s.id === payload.shipment_id);
    if (!targetShipment) return { valid: false, message: 'Shipment not found.' };

    const existingEvents = trackingEvents.filter(
      (e) => e.shipment_id === payload.shipment_id
    );

    const validation = TrackingService.validateNewEvent({
      shipment: targetShipment,
      existingEvents,
      event_type: payload.event_type,
      status_after: payload.status_after,
      event_timestamp: payload.event_timestamp,
      description: payload.description,
    });

    if (!validation.valid) {
      return { valid: false, message: validation.message };
    }

    const newEvent: TrackingEvent = {
      id: Date.now(),
      shipment_id: payload.shipment_id,
      event_type: payload.event_type,
      status_after: payload.status_after,
      event_timestamp: payload.event_timestamp,
      location_id: payload.location_id,
      location_name: payload.location_name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      description: payload.description,
      is_exception: payload.event_type === 'EXCEPTION_REPORTED',
      created_by_user_id: currentUser.id,
      created_by_name: currentUser.name,
    };

    setTrackingEvents((prev) => [...prev, newEvent]);

    const nextStatus = payload.status_after || targetShipment.status;
    const nextEta = payload.revised_eta || targetShipment.estimated_arrival;

    const updatedShipment: Shipment = {
      ...targetShipment,
      status: nextStatus,
      estimated_arrival: nextEta,
      actual_arrival:
        nextStatus === ShipmentStatus.DELIVERED ? payload.event_timestamp : targetShipment.actual_arrival,
      updated_at: new Date().toISOString(),
    };

    setShipments((prev) =>
      prev.map((s) => (s.id === updatedShipment.id ? updatedShipment : s))
    );
    setSelectedShipment(updatedShipment);

    // Check if status changed or delay detected -> generate in-app notification
    if (payload.status_after && payload.status_after !== targetShipment.status) {
      setNotifications((prev) => [
        {
          id: Date.now() + 2,
          user_id: targetShipment.customer_id,
          shipment_id: targetShipment.id,
          shipment_number: targetShipment.shipment_number,
          type: 'STATUS_CHANGED',
          title: `Status Updated: ${targetShipment.shipment_number} → ${payload.status_after}`,
          message: `${payload.description} (${payload.location_name})`,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    setAuditLogs((prev) => [
      {
        id: Date.now() + 3,
        actor_user_id: currentUser.id,
        actor_name: currentUser.name,
        actor_role: currentUser.role,
        action: 'TRACKING_EVENT_ADDED',
        entity_type: 'TrackingEvent',
        entity_id: targetShipment.shipment_number,
        summary: `Added ${payload.event_type} event on ${targetShipment.shipment_number}${
          payload.status_after ? ` (Status → ${payload.status_after})` : ''
        }.`,
        old_values: { status: targetShipment.status },
        new_values: { status: nextStatus, event_type: payload.event_type },
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    return {
      valid: true,
      message: `Event ${payload.event_type} appended to ${targetShipment.shipment_number} timeline.`,
    };
  };

  const handleReportException = (payload: {
    shipment_id: number;
    exception_type: ExceptionType;
    severity: SeverityLevel;
    title: string;
    description: string;
    delay_hours_added: number;
  }) => {
    const target = shipments.find((s) => s.id === payload.shipment_id);
    if (!target) return { valid: false, message: 'Shipment not found.' };

    const nowIso = new Date().toISOString();
    const newExc: ShipmentException = {
      id: Date.now(),
      shipment_id: target.id,
      shipment_number: target.shipment_number,
      exception_type: payload.exception_type,
      severity: payload.severity,
      status: ExceptionStatus.OPEN,
      title: payload.title,
      description: payload.description,
      resolution_notes: null,
      detected_at: nowIso,
      resolved_at: null,
      reported_by_user_id: currentUser.id,
      reported_by_name: currentUser.name,
    };

    setExceptions((prev) => [newExc, ...prev]);

    // Push estimated_arrival forward by delay_hours_added
    const currentEtaMs = new Date(target.estimated_arrival).getTime();
    const revisedEtaIso = new Date(
      currentEtaMs + payload.delay_hours_added * 3600000
    ).toISOString();

    const updatedShipment: Shipment = {
      ...target,
      estimated_arrival: revisedEtaIso,
      updated_at: nowIso,
    };

    setShipments((prev) =>
      prev.map((s) => (s.id === target.id ? updatedShipment : s))
    );
    setSelectedShipment(updatedShipment);

    setNotifications((prev) => [
      {
        id: Date.now() + 5,
        user_id: target.customer_id,
        shipment_id: target.id,
        shipment_number: target.shipment_number,
        type: 'EXCEPTION_OPENED',
        title: `Exception Opened: ${payload.exception_type} on ${target.shipment_number}`,
        message: `${payload.title} (+${payload.delay_hours_added}h ETA impact).`,
        is_read: false,
        created_at: nowIso,
      },
      ...prev,
    ]);

    setAuditLogs((prev) => [
      {
        id: Date.now() + 6,
        actor_user_id: currentUser.id,
        actor_name: currentUser.name,
        actor_role: currentUser.role,
        action: 'EXCEPTION_OPENED',
        entity_type: 'ShipmentException',
        entity_id: target.shipment_number,
        summary: `Opened ${payload.severity} ${payload.exception_type} on ${target.shipment_number}.`,
        old_values: { estimated_arrival: target.estimated_arrival },
        new_values: {
          exception_type: payload.exception_type,
          estimated_arrival: revisedEtaIso,
        },
        created_at: nowIso,
      },
      ...prev,
    ]);

    return {
      valid: true,
      message: `Exception ${payload.exception_type} opened and ETA revised (+${payload.delay_hours_added}h).`,
    };
  };

  const handleResolveException = (exceptionId: number, notes: string) => {
    const targetExc = exceptions.find((e) => e.id === exceptionId);
    if (!targetExc) return;

    const nowIso = new Date().toISOString();
    setExceptions((prev) =>
      prev.map((ex) =>
        ex.id === exceptionId
          ? {
              ...ex,
              status: ExceptionStatus.RESOLVED,
              resolution_notes: notes,
              resolved_at: nowIso,
            }
          : ex
      )
    );

    setAuditLogs((prev) => [
      {
        id: Date.now(),
        actor_user_id: currentUser.id,
        actor_name: currentUser.name,
        actor_role: currentUser.role,
        action: 'EXCEPTION_RESOLVED',
        entity_type: 'ShipmentException',
        entity_id: targetExc.shipment_number,
        summary: `Resolved ${targetExc.exception_type} on ${targetExc.shipment_number}.`,
        old_values: { status: targetExc.status },
        new_values: { status: 'RESOLVED', resolution_notes: notes },
        created_at: nowIso,
      },
      ...prev,
    ]);

    showToast(`Exception on ${targetExc.shipment_number} marked as RESOLVED.`);
  };

  // Export CSV handler for Popular Routes / Filtered Shipments
  const handleExportCsv = () => {
    const headers = [
      'ShipmentNumber',
      'RouteCode',
      'Mode',
      'Customer',
      'Carrier',
      'VehicleRef',
      'Status',
      'ExpectedArrivalUTC',
      'EstimatedArrivalUTC',
      'DelayHours',
      'Severity',
    ];
    const locMap = new Map<number, Location>();
    locations.forEach((l) => locMap.set(l.id, l));
    const carrierMap = new Map<number, Carrier>();
    carriers.forEach((c) => carrierMap.set(c.id, c));

    const rows = filteredShipments.map((sh) => {
      const eta = EtaService.evaluate(
        sh.expected_arrival,
        sh.estimated_arrival,
        settings
      );
      const car = carrierMap.get(sh.carrier_id);
      return [
        sh.shipment_number,
        sh.route_code,
        sh.mode,
        `"${sh.customer_name}"`,
        `"${car?.name || ''}"`,
        `"${sh.vehicle_ref}"`,
        sh.status,
        sh.expected_arrival,
        sh.estimated_arrival,
        eta.delay_hours,
        eta.severity,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cargotrace_shipments_${modeFilter.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredShipments.length} shipment records to CSV.`);
  };

  const canMutate = AuthPolicyService.canMutateShipment(currentUser).valid;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(
      (n) =>
        !n.is_read &&
        (currentUser.role !== UserRole.CUSTOMER || n.user_id === currentUser.id)
    ).length;
  }, [notifications, currentUser]);

  // Paginated shipments for My Orders / Shipments view
  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / PAGE_SIZE));
  const paginatedShipments = filteredShipments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSignOut = () => {
    try {
      localStorage.removeItem('cargotrace_auth_email');
    } catch {
      // Ignore storage errors
    }
    setSelectedShipment(null);
    setIsNewShipmentOpen(false);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <LoginPage
        users={users}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setCurrentPage(1);
          if (
            user.role !== UserRole.ADMIN &&
            (activeSection === 'history' ||
              activeSection === 'carriers' ||
              activeSection === 'locations')
          ) {
            setActiveSection('overview');
          }
          try {
            localStorage.setItem('cargotrace_auth_email', user.email);
          } catch {
            // Ignore storage errors
          }
          showToast(`Signed in as ${user.name} (${formatEnumLabel(user.role)}).`);
        }}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#F4F7FB] text-[#1E293B] flex">
      {/* LEFT SIDEBAR */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-[68px]' : 'w-[256px]'
        } h-screen overflow-y-auto bg-white border-r border-[#DCE4F0] flex flex-col justify-between shrink-0 transition-all duration-200 select-none`}
      >
        {/* Top Workspace Header — DND Atlas Worldwide */}
        <div>
          <div className="h-[60px] px-3 border-b border-[#E2E8F0] flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className="flex items-center overflow-hidden text-left cursor-pointer min-w-0"
            >
              <DndAtlasBrandMark
                size="sm"
                iconOnly={sidebarCollapsed}
                subtitle="WORLDWIDE"
              />
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-[#475569] hover:text-[#072D59] hover:bg-[#F4F7FB]"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Main Navigation List */}
          <nav aria-label="Main navigation" className="p-2.5 space-y-0.5">
            {(
              [
                { id: 'overview', label: 'Overview', icon: LayoutGrid, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'tracking', label: 'Tracking', icon: Search, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'shipments', label: 'My Orders', icon: Package, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'active_routes', label: 'Active routes', icon: MapPin, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'popular_routes', label: 'Popular routes', icon: Route, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'weather', label: 'Weather forecast', icon: CloudSun, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER] },
                { id: 'notifications', label: 'Notifications', icon: Bell, roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER], badge: unreadNotificationsCount },
                { id: 'history', label: 'History', icon: History, roles: [UserRole.ADMIN] },
              ] as const
            )
              .filter((item) => (item.roles as readonly UserRole[]).includes(currentUser.role))
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[#DBF2FC] text-[#072D59] font-semibold'
                        : 'text-[#475569] hover:text-[#072D59] hover:bg-[#F4F7FB]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#072D59]' : 'text-[#475569]'
                        }`}
                        strokeWidth={1.9}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && 'badge' in item && item.badge ? (
                      <span className="px-1.5 py-0.2 rounded-md text-[10.5px] font-bold bg-[#FD6E88] text-white tabular-nums">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}

            {/* Admin Management Group */}
            {isAdmin && (
              <div className="pt-3 mt-3 border-t border-[#DCE4F0] space-y-0.5">
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1 text-[11px] font-semibold text-[#475569]">
                    Administration
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSection('carriers')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    activeSection === 'carriers'
                      ? 'bg-[#DBF2FC] text-[#072D59] font-semibold'
                      : 'text-[#475569] hover:text-[#072D59] hover:bg-[#F4F7FB]'
                  }`}
                >
                  <Navigation className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Carriers & Fleet</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('locations')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    activeSection === 'locations'
                      ? 'bg-[#DBF2FC] text-[#072D59] font-semibold'
                      : 'text-[#475569] hover:text-[#072D59] hover:bg-[#F4F7FB]'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Locations & Hubs</span>}
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Bottom Preferences & Pinned User Profile with Sign Out */}
        <div className="p-2.5 space-y-2 border-t border-[#DCE4F0]">
          <div className="space-y-0.5">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold text-[#475569]">
                Preferences
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeSection === 'settings'
                  ? 'bg-[#DBF2FC] text-[#072D59] font-semibold'
                  : 'text-[#475569] hover:text-[#072D59] hover:bg-[#F4F7FB]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Setting</span>}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('code_ownership')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeSection === 'code_ownership'
                  ? 'bg-[#DBF2FC] text-[#072D59] font-semibold'
                  : 'text-[#475569] hover:text-[#072D59] hover:bg-[#F4F7FB]'
              }`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Architecture Guide</span>}
            </button>
          </div>

          {/* Pinned User Card + Sign Out to Dedicated Login Page */}
          <div className="p-2 rounded-xl bg-[#F8FAFC] border border-[#DCE4F0] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#072D59] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.avatar_initials}
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="text-[12.5px] font-bold text-[#072D59] truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-[#475569] truncate">
                    {currentUser.email}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out and switch account"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-[#475569] hover:text-[#9F1D35] hover:bg-[#FFF0F3] transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR — Clean unclipped section breadcrumb & timestamp on left, actions on right */}
        <header className="h-[58px] bg-white border-b border-[#E2E8F0] px-5 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Clean Section Name + Timestamp (Never truncates to Lo... or Tr...) */}
          <div className="flex items-center gap-2.5 text-[13px] whitespace-nowrap">
            <span className="font-bold text-[#072D59]">
              {SECTION_LABELS[activeSection]}
            </span>
            <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
            <span className="text-[#64748B] tabular-nums text-[12.5px]">
              {serverClock} UTC
            </span>
          </div>

          {/* Right: User Badge + Primary Action Button + Sign Out */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden xl:inline-flex items-center gap-1.5 text-[12.5px] text-[#475569] mr-1">
              <strong className="font-semibold text-[#072D59]">{currentUser.name}</strong>
              <span>({formatEnumLabel(currentUser.role)})</span>
            </span>

            {canMutate && (
              <button
                type="button"
                onClick={() => setIsNewShipmentOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white text-[12.5px] font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Shipping</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#072D59] hover:bg-[#F8FAFC] text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="mx-5 mt-3 px-4 py-2.5 rounded-xl bg-[#072D59] text-white text-[12.5px] font-medium flex items-center justify-between shadow-md">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#DBF2FC]" />
              {toastMessage}
            </span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-xs text-[#DBF2FC] underline ml-4"
            >
              Close
            </button>
          </div>
        )}

        {/* PAGE VIEWPORT */}
        <main className="flex-1 p-5 space-y-4 overflow-y-auto">
          {/* ===================================================================
              SECTION 1: LOGISTICS OVERVIEW DASHBOARD (Yuke.inc Reference Layout)
          =================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              {/* Page Header matching Yuke.inc */}
              <div>
                <h1 className="text-[21px] font-bold text-[#0F172A] tracking-tight">
                  Logistics Overview
                </h1>
                <p className="text-[13px] text-[#64748B]">
                  Track shipments, corridor capacity, and delivery performance ({settings.primary_route_focus} · {settings.delay_threshold_hours}h threshold)
                </p>
              </div>

              {/* Single 4-Column Row of KPI Cards (md:grid-cols-4 so all 4 sit in 1 row like Yuke.inc) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <KpiStatCard
                  percentage={kpiMetrics.onTimeRate}
                  barColorHex="#1E40AF"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="On-Time Delivery"
                  primaryValue={`${kpiMetrics.onTimeCount}/${kpiMetrics.total}`}
                  unitLabel="Shipped"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setActiveSection('shipments');
                  }}
                />

                <KpiStatCard
                  percentage={kpiMetrics.inTransitRate}
                  barColorHex="#E11D48"
                  icon={<Navigation className="w-4 h-4" />}
                  label="In Transit"
                  primaryValue={`${kpiMetrics.inTransit}/${kpiMetrics.total}`}
                  unitLabel="Active"
                  onClick={() => {
                    setStatusFilter(ShipmentStatus.IN_TRANSIT);
                    setActiveSection('shipments');
                  }}
                />

                <KpiStatCard
                  percentage={kpiMetrics.delayedRate}
                  barColorHex="#F59E0B"
                  icon={<Clock className="w-4 h-4" />}
                  label="Delayed Shipments"
                  primaryValue={`${kpiMetrics.delayedCount}/${kpiMetrics.total}`}
                  unitLabel="Delayed"
                  onClick={() => {
                    setStatusFilter('DELAYED');
                    setActiveSection('shipments');
                  }}
                />

                <KpiStatCard
                  percentage={kpiMetrics.openExceptionRate}
                  barColorHex="#0D9488"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Open Exceptions"
                  primaryValue={`${kpiMetrics.openExceptions}/${kpiMetrics.totalExceptions}`}
                  unitLabel="Resolved"
                  onClick={() => setActiveSection('exceptions')}
                />
              </div>

              {/* Filter & Search Toolbar Row matching Yuke.inc */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                  <select
                    aria-label="Filter by transport mode"
                    value={modeFilter}
                    onChange={(e) => {
                      setModeFilter(e.target.value as 'ALL' | TransportMode);
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-[#0F172A] shadow-2xs focus:outline-none focus:border-[#072D59]"
                  >
                    <option value="ALL">Shipping (All)</option>
                    <option value={TransportMode.SEA}>Sea Freight</option>
                    <option value={TransportMode.AIR}>Air Freight</option>
                    <option value={TransportMode.ROAD}>Road Freight</option>
                  </select>

                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      aria-label="Search shipments, routes, carriers, or cities"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search shipment DND-2026-..., route, carrier, city..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-[12.5px] text-[#0F172A] placeholder:text-[#94A3B8] shadow-2xs focus:outline-none focus:border-[#072D59]"
                    />
                  </div>
                </div>

                {/* Segmented Time-Range Control */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E2E8F0] shadow-2xs">
                  {(['15m', '1h', '24h', '3d', '7d', 'all'] as TimeRangeSegment[]).map(
                    (seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => setTimeSegment(seg)}
                        className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-colors tabular-nums ${
                          timeSegment === seg
                            ? 'bg-[#072D59] text-white shadow-2xs'
                            : 'text-[#64748B] hover:text-[#072D59]'
                        }`}
                      >
                        {seg}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Shipments Analytics Card (Chart.js) */}
              <ShipmentsAnalyticsChart
                shipments={filteredShipments}
                carriers={carriers}
              />

              {/* Popular Routes Section matching Yuke.inc */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#0F172A]">
                      Popular routes
                    </h2>
                    <p className="text-[12px] text-[#64748B]">
                      Ranked by shipment volume · November 2026
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3.5 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0F172A] text-[12px] font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs">
                  {popularRoutes.length === 0 ? (
                    <div className="p-10 text-center text-[#64748B] text-[13px]">
                      No routes match the current filter criteria. Try resetting the mode or time range filter.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead>
                          <tr className="border-b border-[#EEF2F7] text-[#64748B] text-[11.5px] bg-[#FAFBFD]">
                            <th className="py-3 px-4 font-medium">Route</th>
                            <th className="py-3 px-3 font-medium">Carrier / vehicle</th>
                            <th className="py-3 px-3 font-medium">Status</th>
                            <th className="py-3 px-3 font-medium">Mode</th>
                            <th className="py-3 px-3 font-medium">Distance</th>
                            <th className="py-3 px-3 font-medium text-right">Shipments</th>
                            <th className="py-3 px-3 font-medium text-right">Avg. transit</th>
                            <th className="py-3 px-4 font-medium text-right">On-time rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {popularRoutes.map((row) => {
                            const initials = `${row.origin.city[0] || 'O'}${
                              row.destination.city[0] || 'D'
                            }`.toUpperCase();
                            return (
                              <tr
                                key={`${row.route_code}-${row.origin.id}-${row.destination.id}-${row.mode}`}
                                onClick={() => {
                                  const found = shipments.find(
                                    (s) => s.id === row.sample_shipment_id
                                  );
                                  if (found) setSelectedShipment(found);
                                }}
                                className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                              >
                                {/* Route Column (Initials badge + Origin To Destination + route code) */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-[#FFF4ED] text-[#C2410C] font-bold text-[11.5px] flex items-center justify-center shrink-0 border border-[#FFEDD5]">
                                      {initials}
                                    </div>
                                    <div>
                                      <div className="font-bold text-[#0F172A] whitespace-nowrap">
                                        {row.origin.city}{' '}
                                        <span className="text-[#94A3B8] font-normal">To</span>{' '}
                                        {row.destination.city}
                                      </div>
                                      <div className="text-[11px] text-[#64748B] tabular-nums">
                                        {row.route_code}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Carrier / Vehicle Column (Real Vehicle Photo + Carrier Name + Vehicle Model) */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-3">
                                    <ModeIconChip mode={row.mode} size="md" />
                                    <div>
                                      <div className="font-bold text-[#0F172A] whitespace-nowrap">
                                        {row.carrier.name}
                                      </div>
                                      <div className="text-[11.5px] text-[#64748B] whitespace-nowrap">
                                        {row.vehicle_ref}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Status Badge */}
                                <td className="py-3 px-3">
                                  <ShipmentStatusBadge
                                    status={row.representative_status}
                                    isDelayed={row.is_delayed}
                                  />
                                </td>

                                {/* Mode */}
                                <td className="py-3 px-3 whitespace-nowrap text-[12px] text-[#64748B]">
                                  <span className="text-[#64748B]">{formatEnumLabel(row.mode)}</span>{' '}
                                  <strong className="text-[#0F172A]">{row.mode_label}</strong>
                                </td>

                                {/* Distance */}
                                <td className="py-3 px-3 tabular-nums font-bold text-[#0F172A] whitespace-nowrap">
                                  {row.distance_mi.toLocaleString()} mi
                                </td>

                                {/* Shipments Count */}
                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[#0F172A]">
                                  {row.shipment_count}
                                </td>

                                {/* Avg Transit */}
                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[#0F172A] whitespace-nowrap">
                                  {row.avg_transit_days} days
                                </td>

                                {/* On-Time Rate */}
                                <td className="py-3 px-4 text-right tabular-nums font-bold text-[#0F172A]">
                                  {row.on_time_rate}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 2: TRACKING SEARCH & TIMELINE INSPECTOR (Slide 7)
          =================================================================== */}
          {activeSection === 'tracking' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-[21px] font-bold text-[#072D59]">
                  Shipment Tracking & Timeline Inspector
                </h1>
                <p className="text-[13px] text-[#6B7A93]">
                  Look up any shipment by reference number (e.g. DND-2026-000101) to inspect chronological events, current location, and deterministic ETA rules
                </p>
              </div>

              <div className="bg-white border border-[#E3E9F3] rounded-xl p-5 space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const normalizedInput = trackingLookupInput
                      .trim()
                      .toLowerCase()
                      .replace(/^ct-2026-/, 'dnd-2026-');
                    const found = roleScopedShipments.find(
                      (s) => s.shipment_number.toLowerCase() === normalizedInput
                    );
                    if (found) {
                      setSelectedShipment(found);
                    } else {
                      showToast(
                        `Shipment "${trackingLookupInput}" not found or unauthorized for ${currentUser.role}.`
                      );
                    }
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-[#6B7A93] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={trackingLookupInput}
                      onChange={(e) => setTrackingLookupInput(e.target.value)}
                      placeholder="Enter Shipment Number (e.g. DND-2026-000101, DND-2026-000201, DND-2026-000301)..."
                      className="w-full bg-[#F4F7FB] border border-[#E3E9F3] rounded-lg pl-10 pr-4 py-2 text-[13px] font-mono-tabular text-[#072D59] focus:bg-white focus:border-[#072D59] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#072D59] text-white text-[13px] font-semibold hover:bg-[#051F3E]"
                  >
                    Inspect Timeline
                  </button>
                </form>

                {/* Quick sample pills */}
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-[#6B7A93]">Quick Select:</span>
                  {roleScopedShipments.slice(0, 6).map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => {
                        setTrackingLookupInput(sh.shipment_number);
                        setSelectedShipment(sh);
                      }}
                      className="px-2.5 py-1 rounded-md bg-[#DBF2FC] text-[#072D59] font-mono-tabular font-semibold hover:bg-[#B8E2F8] transition-colors"
                    >
                      {sh.shipment_number} ({sh.mode})
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Shipments Cards with 5-Stage Progress Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roleScopedShipments.slice(0, 9).map((sh) => {
                  const eta = EtaService.evaluate(
                    sh.expected_arrival,
                    sh.estimated_arrival,
                    settings
                  );
                  const orig = locations.find((l) => l.id === sh.origin_location_id);
                  const dest = locations.find((l) => l.id === sh.destination_location_id);
                  const car = carriers.find((c) => c.id === sh.carrier_id);
                  const stages = [
                    ShipmentStatus.CREATED,
                    ShipmentStatus.BOOKED,
                    ShipmentStatus.PICKED_UP,
                    ShipmentStatus.IN_TRANSIT,
                    ShipmentStatus.DELIVERED,
                  ];
                  const stageIdx = stages.indexOf(sh.status);
                  const progressPct = Math.round(((stageIdx + 1) / stages.length) * 100);

                  return (
                    <div
                      key={sh.id}
                      onClick={() => setSelectedShipment(sh)}
                      className="bg-white border border-[#DCE4F0] hover:border-[#072D59] rounded-xl p-4 cursor-pointer transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular font-bold text-[#072D59] text-[14px]">
                          {sh.shipment_number}
                        </span>
                        <ShipmentStatusBadge
                          status={sh.status}
                          isDelayed={eta.is_delayed && sh.status !== ShipmentStatus.DELIVERED}
                        />
                      </div>

                      <div className="flex items-center gap-2.5">
                        <ModeIconChip mode={sh.mode} size="sm" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-[#072D59] truncate">
                            {orig?.city} ({orig?.code}) → {dest?.city} ({dest?.code})
                          </div>
                          <div className="text-[11.5px] text-[#475569] truncate">
                            {car?.name} · {sh.vehicle_ref}
                          </div>
                        </div>
                      </div>

                      <div className="text-[12px] text-[#1E293B] bg-[#F8FAFC] px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] truncate">
                        <span className="font-semibold text-[#072D59]">Cargo:</span> {sh.cargo_type}
                      </div>

                      {/* Visual Lifecycle Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] tabular-nums text-[#475569]">
                          <span>Stage {stageIdx + 1} of 5 · {formatEnumLabel(sh.status)}</span>
                          <span className="font-bold text-[#072D59]">{progressPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPct}%`,
                              backgroundColor:
                                eta.is_delayed && sh.status !== ShipmentStatus.DELIVERED
                                  ? '#FD6E88'
                                  : '#072D59',
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#E3E9F3] flex items-center justify-between text-[12px]">
                        <SeverityBadge severity={eta.severity} />
                        <span className="text-[#072D59] font-bold">
                          Inspect Timeline →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 3: MY ORDERS / SHIPMENTS LIST (Search, Filters, Pagination)
          =================================================================== */}
          {activeSection === 'shipments' && (
            <div className="space-y-4">
              {/* Top Header & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59] tracking-tight">
                    My Orders & Shipments Directory
                  </h1>
                  <p className="text-[13px] text-[#64748B]">
                    Operational multimodal shipments ledger with status tabs, carrier manifest details, and pagination
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#072D59] text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() => setIsNewShipmentOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New shipment</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Unified Filter Card: Quick Status Tabs + Single-Row Search/Mode/Sort Toolbar */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl p-3.5 space-y-3 shadow-2xs">
                {/* Quick Status Filter Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EEF2F8]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        {
                          id: 'ALL',
                          label: 'All Orders',
                          count: roleScopedShipments.length,
                        },
                        {
                          id: ShipmentStatus.IN_TRANSIT,
                          label: 'In Transit',
                          count: roleScopedShipments.filter((s) => s.status === ShipmentStatus.IN_TRANSIT).length,
                        },
                        {
                          id: 'DELAYED',
                          label: 'Delayed / Hold',
                          count: roleScopedShipments.filter((s) => {
                            const ev = EtaService.evaluate(s.expected_arrival, s.estimated_arrival, settings);
                            return ev.is_delayed && s.status !== ShipmentStatus.DELIVERED;
                          }).length,
                        },
                        {
                          id: ShipmentStatus.BOOKED,
                          label: 'Booked',
                          count: roleScopedShipments.filter((s) => s.status === ShipmentStatus.BOOKED).length,
                        },
                        {
                          id: ShipmentStatus.PICKED_UP,
                          label: 'Picked Up',
                          count: roleScopedShipments.filter((s) => s.status === ShipmentStatus.PICKED_UP).length,
                        },
                        {
                          id: ShipmentStatus.DELIVERED,
                          label: 'Delivered',
                          count: roleScopedShipments.filter((s) => s.status === ShipmentStatus.DELIVERED).length,
                        },
                      ] as const
                    ).map((tab) => {
                      const active = statusFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setStatusFilter(tab.id);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? tab.id === 'DELAYED'
                                ? 'bg-[#FFF0F3] text-[#9F1D35] border border-[#FD6E88]'
                                : 'bg-[#072D59] text-white'
                              : 'bg-[#F4F7FB] text-[#475569] hover:text-[#072D59] hover:bg-[#E2E8F0]/60'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={`text-[11px] tabular-nums font-bold px-1.5 py-0.2 rounded ${
                              active
                                ? tab.id === 'DELAYED'
                                  ? 'bg-[#FD6E88] text-white'
                                  : 'bg-white/20 text-white'
                                : 'bg-white text-[#072D59]'
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-[11.5px] text-[#64748B] tabular-nums">
                    Showing <strong className="text-[#072D59]">{filteredShipments.length}</strong> matching orders
                  </span>
                </div>

                {/* Single-Row Search, Mode, Status, and Sort Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search by DND-2026-..., customer, vessel/flight/truck, cargo, or city..."
                      className="w-full bg-[#F8FAFC] border border-[#DCE4F0] focus:bg-white focus:border-[#072D59] focus:outline-none rounded-lg pl-9 pr-3 py-2 text-[12.5px] text-[#0F172A]"
                    />
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    <select
                      aria-label="Filter shipments by mode"
                      value={modeFilter}
                      onChange={(e) => {
                        setModeFilter(e.target.value as 'ALL' | TransportMode);
                        setCurrentPage(1);
                      }}
                      className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-lg px-3 py-2 text-[12px] font-semibold text-[#072D59] cursor-pointer"
                    >
                      <option value="ALL">All Modes (Sea / Air / Road)</option>
                      <option value={TransportMode.SEA}>Sea Freight (Vessel)</option>
                      <option value={TransportMode.AIR}>Air Freight (Aircraft)</option>
                      <option value={TransportMode.ROAD}>Road Freight (Truck)</option>
                    </select>

                    <select
                      aria-label="Filter shipments by status"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value as 'ALL' | ShipmentStatus | 'DELAYED');
                        setCurrentPage(1);
                      }}
                      className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-lg px-3 py-2 text-[12px] font-semibold text-[#072D59] cursor-pointer"
                    >
                      <option value="ALL">Status: All</option>
                      <option value="DELAYED">Status: Delayed Only</option>
                      {Object.values(ShipmentStatus).map((st) => (
                        <option key={st} value={st}>
                          Status: {formatEnumLabel(st)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setSortField((f) =>
                          f === 'expected_arrival' ? 'shipment_number' : 'expected_arrival'
                        );
                        setSortAsc((a) => !a);
                      }}
                      className="px-3 py-2 rounded-lg border border-[#DCE4F0] bg-[#F8FAFC] hover:bg-[#EEF2F8] text-[12px] font-semibold text-[#072D59] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#072D59]" />
                      <span>
                        Sort: {sortField === 'expected_arrival' ? 'Arrival Date' : 'Shipment #'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Clean, Balanced Shipments Table (Zero Horizontal Clipping on Laptop & Desktop) */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-[#F4F7FB] border-b border-[#DCE4F0] text-[#475569] text-[11px] uppercase tracking-wider">
                        <th className="py-3 pl-4 pr-2.5 font-bold">Shipment & Customer</th>
                        <th className="py-3 px-2.5 font-bold">Origin → Destination</th>
                        <th className="py-3 px-2.5 font-bold">Carrier & Fleet</th>
                        <th className="py-3 px-2.5 font-bold text-center">ETA & Schedule</th>
                        <th className="py-3 px-2.5 font-bold text-center">Status</th>
                        <th className="py-3 pl-2.5 pr-4 font-bold text-center w-[96px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E9F3]">
                      {paginatedShipments.map((sh) => {
                        const orig = locations.find((l) => l.id === sh.origin_location_id);
                        const dest = locations.find((l) => l.id === sh.destination_location_id);
                        const car = carriers.find((c) => c.id === sh.carrier_id);
                        const eta = EtaService.evaluate(
                          sh.expected_arrival,
                          sh.estimated_arrival,
                          settings
                        );
                        const isDelayed =
                          eta.is_delayed && sh.status !== ShipmentStatus.DELIVERED;

                        return (
                          <tr
                            key={sh.id}
                            onClick={() => setSelectedShipment(sh)}
                            className="hover:bg-[#DBF2FC]/30 cursor-pointer transition-colors"
                          >
                            {/* 1. Shipment #, Customer & Cargo */}
                            <td className="py-2.5 pl-4 pr-2.5 align-middle max-w-[165px]">
                              <div className="font-mono-tabular font-bold text-[#072D59] text-[12.5px] whitespace-nowrap">
                                {sh.shipment_number}
                              </div>
                              <div
                                className="text-[11px] font-medium text-[#334155] truncate"
                                title={`${sh.customer_name} · ${sh.cargo_type}`}
                              >
                                {sh.customer_name}
                              </div>
                              <div
                                className="text-[10.5px] text-[#64748B] truncate"
                                title={sh.cargo_type}
                              >
                                {sh.cargo_type}
                              </div>
                            </td>

                            {/* 2. Origin -> Destination + Weight */}
                            <td className="py-2.5 px-2.5 align-middle max-w-[185px]">
                              <div
                                className="font-semibold text-[#0F172A] text-[12px] truncate"
                                title={`${orig?.city} (${orig?.code}) → ${dest?.city} (${dest?.code})`}
                              >
                                {orig?.city} ({orig?.code}) → {dest?.city} ({dest?.code})
                              </div>
                              <div className="text-[10.5px] text-[#64748B] font-mono-tabular truncate">
                                {sh.route_code} · {sh.total_weight_kg.toLocaleString()} kg · {sh.total_volume_cbm} CBM
                              </div>
                            </td>

                            {/* 3. Carrier & Vehicle (Truncated cleanly so it NEVER wraps into vertical lines) */}
                            <td className="py-2.5 px-2.5 align-middle max-w-[185px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <ModeIconChip mode={sh.mode} size="sm" />
                                <div className="min-w-0">
                                  <div
                                    className="font-semibold text-[#072D59] text-[12px] truncate"
                                    title={car?.name}
                                  >
                                    {car?.name}
                                  </div>
                                  <div
                                    className="text-[10.5px] text-[#64748B] tabular-nums truncate"
                                    title={sh.vehicle_ref}
                                  >
                                    {sh.vehicle_ref}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 4. ETA & Schedule (Centered) */}
                            <td className="py-2.5 px-2.5 align-middle text-center whitespace-nowrap">
                              <div className="tabular-nums font-semibold text-[11.5px] text-[#072D59]">
                                {new Date(sh.estimated_arrival).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                UTC
                              </div>
                              <div className="mt-0.5 flex justify-center">
                                <SeverityBadge severity={eta.severity} />
                              </div>
                            </td>

                            {/* 5. Status (Centered) */}
                            <td className="py-2.5 px-2.5 align-middle text-center whitespace-nowrap">
                              <ShipmentStatusBadge
                                status={sh.status}
                                isDelayed={isDelayed}
                              />
                            </td>

                            {/* 6. Centered Action Button */}
                            <td className="py-2.5 pl-2.5 pr-4 align-middle text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShipment(sh);
                                }}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#072D59] text-[#072D59] hover:text-white border border-[#DCE4F0] hover:border-[#072D59] text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <span>Inspect</span>
                                <span>→</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-[#475569] tabular-nums">
                    Showing{' '}
                    <strong className="text-[#072D59]">
                      {filteredShipments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentPage * PAGE_SIZE, filteredShipments.length)}
                    </strong>{' '}
                    of <strong className="text-[#072D59]">{filteredShipments.length}</strong> shipments
                    <span className="text-[#94A3B8] ml-1.5">
                      (Halaman {currentPage} dari {totalPages})
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 font-semibold text-[#072D59] cursor-pointer"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-[12px] font-bold tabular-nums transition-colors cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-[#072D59] text-white'
                            : 'bg-white border border-[#CBD5E1] text-[#072D59] hover:bg-[#F1F5F9]'
                        }`}
                        title={`Go to Page ${pageNum}`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 font-semibold text-[#072D59] cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 4: ACTIVE ROUTES (3D Globe OpenStreetMap + Layer Toggle)
          =================================================================== */}
          {activeSection === 'active_routes' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    Active Multimodal Routes Map
                  </h1>
                  <p className="text-[13.5px] text-[#475569]">
                    Use the <strong className="text-[#072D59]">Layer Toggle</strong> panel on the top-right of the map to independently show or hide <strong className="text-[#072D59]">Sea</strong>, <strong className="text-[#072D59]">Air</strong>, and <strong className="text-[#072D59]">Road</strong> corridors, logistics hubs, or delayed shipments.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[12px] tabular-nums bg-white px-3.5 py-2 rounded-xl border border-[#DCE4F0]">
                  <span className="text-[#475569]">Active Corridors:</span>
                  <strong className="text-[#072D59]">{roleScopedShipments.length} total</strong>
                  <span className="text-[#CBD5E1]">·</span>
                  <span className="text-[#072D59] font-medium">
                    Sea {roleScopedShipments.filter((s) => s.mode === TransportMode.SEA).length}
                  </span>
                  <span className="text-[#CBD5E1]">·</span>
                  <span className="text-[#3E6FB4] font-medium">
                    Air {roleScopedShipments.filter((s) => s.mode === TransportMode.AIR).length}
                  </span>
                  <span className="text-[#CBD5E1]">·</span>
                  <span className="text-[#2F8F9A] font-medium">
                    Road {roleScopedShipments.filter((s) => s.mode === TransportMode.ROAD).length}
                  </span>
                </div>
              </div>

              <CargoTraceLeafletMap
                shipments={roleScopedShipments}
                locations={locations}
                carriers={carriers}
                trackingEvents={trackingEvents}
                settings={settings}
                selectedShipmentId={selectedShipment?.id || null}
                onSelectShipment={(sh) => setSelectedShipment(sh)}
                heightClass="h-[520px]"
              />

              {/* Readable Active Shipments Quick-Inspect Table Below Map */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E3E9F3] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[14.5px] font-bold text-[#072D59]">
                      Active Corridor Shipments Directory
                    </h2>
                    <p className="text-[12px] text-[#475569]">
                      Click any shipment row or the Inspect button to view its chronological checkpoints, destination weather, and route trajectory
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('shipments')}
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[12px] font-semibold text-[#072D59] cursor-pointer transition-colors"
                  >
                    View All {roleScopedShipments.length} Shipments →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[#DCE4F0] text-[#475569] text-[11px] uppercase tracking-wider bg-[#F4F7FB]">
                        <th className="py-3 pl-4 pr-2.5 font-bold">Shipment #</th>
                        <th className="py-3 px-2.5 font-bold">Mode & Carrier</th>
                        <th className="py-3 px-2.5 font-bold">Origin → Destination</th>
                        <th className="py-3 px-2.5 font-bold text-center">Status</th>
                        <th className="py-3 px-2.5 font-bold text-center">Schedule Variance</th>
                        <th className="py-3 pl-2.5 pr-4 font-bold text-center w-[124px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E9F3]">
                      {roleScopedShipments.slice(0, 8).map((sh) => {
                        const orig = locations.find((l) => l.id === sh.origin_location_id);
                        const dest = locations.find((l) => l.id === sh.destination_location_id);
                        const car = carriers.find((c) => c.id === sh.carrier_id);
                        const eta = EtaService.evaluate(
                          sh.expected_arrival,
                          sh.estimated_arrival,
                          settings
                        );
                        return (
                          <tr
                            key={sh.id}
                            onClick={() => setSelectedShipment(sh)}
                            className="hover:bg-[#DBF2FC]/35 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 pl-4 pr-2.5 align-middle font-mono-tabular font-bold text-[#072D59] whitespace-nowrap">
                              {sh.shipment_number}
                            </td>
                            <td className="py-2.5 px-2.5 align-middle max-w-[180px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <ModeIconChip mode={sh.mode} size="sm" />
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#072D59] truncate" title={car?.name}>
                                    {car?.name}
                                  </div>
                                  <div className="text-[10.5px] tabular-nums text-[#475569] truncate" title={sh.vehicle_ref}>
                                    {sh.vehicle_ref}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 align-middle font-semibold text-[#1E293B] max-w-[180px] truncate" title={`${orig?.city} (${orig?.code}) → ${dest?.city} (${dest?.code})`}>
                              {orig?.city} ({orig?.code}) → {dest?.city} ({dest?.code})
                            </td>
                            <td className="py-2.5 px-2.5 align-middle text-center whitespace-nowrap">
                              <ShipmentStatusBadge
                                status={sh.status}
                                isDelayed={eta.is_delayed && sh.status !== ShipmentStatus.DELIVERED}
                              />
                            </td>
                            <td className="py-2.5 px-2.5 align-middle text-center whitespace-nowrap">
                              <SeverityBadge severity={eta.severity} />
                            </td>
                            <td className="py-2.5 pl-2.5 pr-4 align-middle text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShipment(sh);
                                }}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#072D59] text-[#072D59] hover:text-white border border-[#DCE4F0] hover:border-[#072D59] text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <span>Open Details</span>
                                <span>→</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 5: POPULAR ROUTES REPORT
          =================================================================== */}
          {activeSection === 'popular_routes' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    Popular Corridors & Route Volume Analytics
                  </h1>
                  <p className="text-[13px] text-[#64748B]">
                    Aggregated corridor performance ranked by active shipment volume (jumlah kargo aktif per rute), haversine distance, and on-time rate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Routes CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {popularRoutes.map((r, idx) => (
                  <div
                    key={`${r.route_code}-${r.origin.id}-${r.destination.id}-${r.mode}`}
                    onClick={() => {
                      const sh = shipments.find((s) => s.id === r.sample_shipment_id);
                      if (sh) setSelectedShipment(sh);
                    }}
                    className="bg-white border border-[#DCE4F0] hover:border-[#072D59] rounded-xl p-4 cursor-pointer transition-all flex flex-col justify-between gap-3.5 overflow-hidden shadow-2xs"
                  >
                    {/* Top Row: Vehicle Photo + Mode Name on Left, Contained Volume Box on Right */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                        <ModeIconChip mode={r.mode} size="sm" showLabel />
                      </div>
                      <div className="shrink-0 bg-[#F4F7FB] border border-[#DCE4F0] rounded-lg px-2.5 py-1 text-right">
                        <span className="block tabular-nums text-[12px] font-extrabold text-[#072D59] leading-tight whitespace-nowrap">
                          {r.shipment_count} {r.shipment_count === 1 ? 'Shipment' : 'Shipments'}
                        </span>
                        <span className="block text-[9.5px] font-medium text-[#64748B] leading-tight whitespace-nowrap">
                          Rank #{idx + 1} Volume
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Origin -> Destination & Carrier */}
                    <div className="min-w-0 space-y-1">
                      <div className="text-[14.5px] font-bold text-[#072D59] leading-snug truncate">
                        {r.origin.city} ({r.origin.code}) → {r.destination.city} ({r.destination.code})
                      </div>
                      <div
                        className="text-[11.5px] text-[#475569] truncate"
                        title={`${r.carrier.name} · ${r.vehicle_ref}`}
                      >
                        {r.carrier.name} · {r.vehicle_ref}
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#E3E9F3] text-[12px] tabular-nums">
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Distance</span>
                        <strong className="text-[#072D59]">{r.distance_mi.toLocaleString()} mi</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Avg. Transit</span>
                        <strong className="text-[#072D59]">{r.avg_transit_days} days</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">On-Time Rate</span>
                        <strong className="text-[#072D59]">{r.on_time_rate}%</strong>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="font-mono-tabular font-semibold text-[#64748B] truncate">
                        Corridor {r.route_code}
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1 font-bold text-[#072D59] group-hover:underline">
                        Inspect Route →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 6: WEATHER FORECAST (Open-Meteo Live Integration)
          =================================================================== */}
          {activeSection === 'weather' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    Port, Airport & Depot Weather Telemetry
                  </h1>
                  <p className="text-[13px] text-[#6B7A93]">
                    Live meteorological conditions at multimodal hubs via Open-Meteo API for operational visibility
                  </p>
                </div>
              </div>

              {loadingWeatherAll ? (
                <div className="p-8 bg-white border border-[#E3E9F3] rounded-xl text-center text-[#6B7A93]">
                  Fetching live meteorological telemetry from Open-Meteo API...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {locations.slice(0, 8).map((loc) => {
                    const snap = weatherSnapshots[loc.code];
                    return (
                      <div
                        key={loc.id}
                        className="bg-white border border-[#E3E9F3] rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#072D59] text-[13.5px]">
                              {loc.city} ({loc.code})
                            </div>
                            <div className="text-[11px] text-[#6B7A93] truncate">
                              {loc.name}
                            </div>
                          </div>
                          <LocationTypeBadge type={loc.type} />
                        </div>

                        {snap ? (
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between pt-1 pb-2 border-b border-[#E3E9F3]">
                              <span className="text-[22px] font-bold text-[#072D59] tabular-nums">
                                {snap.temperature_c}°C
                              </span>
                              <span className="text-[11.5px] font-semibold text-[#072D59]">
                                {snap.condition_label}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11.5px] text-[#6B7A93] tabular-nums">
                              <div>Wind: <strong className="text-[#243350]">{snap.wind_speed_kmh} km/h</strong></div>
                              <div>Visibility: <strong className="text-[#243350]">{snap.visibility_km} km</strong></div>
                            </div>
                            <div className="text-[10.5px] text-[#6B7A93] pt-1">
                              Source: {snap.source}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-[#6B7A93]">
                            Weather unavailable — showing cached operational state.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===================================================================
              SECTION 7: EXCEPTIONS MANAGEMENT
          =================================================================== */}
          {activeSection === 'exceptions' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[21px] font-bold text-[#072D59]">
                  Shipment Exceptions & Incident Management
                </h1>
                <p className="text-[13px] text-[#6B7A93]">
                  Monitor and resolve customs holds, weather disruptions, port congestion, cargo damage, and documentation incidents
                </p>
              </div>

              <div className="bg-white border border-[#DCE4F0] rounded-xl divide-y divide-[#E3E9F3] overflow-hidden">
                {exceptions
                  .filter((ex) =>
                    roleScopedShipments.some((s) => s.id === ex.shipment_id)
                  )
                  .map((ex) => {
                    const sh = shipments.find((s) => s.id === ex.shipment_id);
                    return (
                      <div
                        key={ex.id}
                        className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-5 hover:bg-[#F8FAFC] transition-colors"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          {/* Top metadata row: only ONE status badge + clean text metadata separated by dots */}
                          <div className="flex flex-wrap items-center gap-2 text-[12px]">
                            <button
                              type="button"
                              onClick={() => sh && setSelectedShipment(sh)}
                              className="font-mono-tabular font-bold text-[13px] text-[#072D59] hover:underline"
                            >
                              {ex.shipment_number}
                            </button>
                            <span className="text-[#CBD5E1]">·</span>
                            <span className="font-semibold text-[#072D59]">
                              {formatEnumLabel(ex.exception_type)}
                            </span>
                            <span className="text-[#CBD5E1]">·</span>
                            <SeverityBadge severity={ex.severity} />
                            <span className="text-[#CBD5E1]">·</span>
                            <ExceptionStatusBadge status={ex.status} />
                          </div>

                          <h3 className="text-[15px] font-bold text-[#072D59] pt-0.5">
                            {ex.title}
                          </h3>
                          <p className="text-[13px] text-[#334155] leading-relaxed max-w-3xl">
                            {ex.description}
                          </p>
                          <div className="text-[11.5px] text-[#64748B] tabular-nums pt-0.5">
                            Detected {new Date(ex.detected_at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · Reported by <span className="font-medium text-[#334155]">{ex.reported_by_name}</span>
                            {ex.resolved_at && (
                              <>
                                {' '}
                                · Resolved{' '}
                                {new Date(ex.resolved_at).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 md:pt-1">
                          {sh && (
                            <button
                              type="button"
                              onClick={() => setSelectedShipment(sh)}
                              className="px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[12px] font-semibold text-[#072D59] hover:bg-[#F1F5F9] transition-colors"
                            >
                              Inspect Shipment
                            </button>
                          )}
                          {canMutate && ex.status !== ExceptionStatus.RESOLVED && (
                            <button
                              type="button"
                              onClick={() =>
                                handleResolveException(
                                  ex.id,
                                  'Cleared by operations desk and updated carrier manifest.'
                                )
                              }
                              className="px-3.5 py-1.5 rounded-lg bg-[#072D59] text-white text-[12px] font-semibold hover:bg-[#051F3E] transition-colors"
                            >
                              Resolve Hold
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 8: NOTIFICATIONS CENTER
          =================================================================== */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    In-App Notifications
                  </h1>
                  <p className="text-[13px] text-[#6B7A93]">
                    Operational alerts for status transitions, delay thresholds, and exception updates
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.map((n) => ({ ...n, is_read: true }))
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-[#E3E9F3] bg-white text-[12px] font-semibold text-[#072D59] hover:bg-[#DBF2FC]/40"
                >
                  Mark All as Read
                </button>
              </div>

              <div className="bg-white border border-[#DCE4F0] rounded-xl divide-y divide-[#E3E9F3] overflow-hidden">
                {notifications
                  .filter(
                    (n) =>
                      currentUser.role !== UserRole.CUSTOMER ||
                      n.user_id === currentUser.id
                  )
                  .map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((item) =>
                            item.id === n.id ? { ...item, is_read: true } : item
                          )
                        );
                        const sh = shipments.find((s) => s.id === n.shipment_id);
                        if (sh) setSelectedShipment(sh);
                      }}
                      className={`p-4 cursor-pointer transition-colors flex items-start justify-between gap-4 ${
                        n.is_read
                          ? 'bg-white hover:bg-[#F8FAFC]'
                          : 'bg-[#DBF2FC]/35 hover:bg-[#DBF2FC]/55'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[12px]">
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[#072D59] shrink-0" />
                          )}
                          <span className="font-semibold text-[#475569]">
                            {formatEnumLabel(n.type)}
                          </span>
                          <span className="text-[#CBD5E1]">·</span>
                          <span className="font-bold text-[#072D59] text-[13.5px]">
                            {n.title}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-[#334155]">{n.message}</p>
                      </div>
                      <span className="text-[11.5px] tabular-nums text-[#64748B] shrink-0">
                        {new Date(n.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 9: AUDIT LOG (Admin Only)
          =================================================================== */}
          {/* ===================================================================
              SECTION 9: AUDIT LOG & OPERATIONAL HISTORY (Admin Only)
          =================================================================== */}
          {activeSection === 'history' && isAdmin && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59] tracking-tight">
                    Operational History & System Audit Trail
                  </h1>
                  <p className="text-[13px] text-[#64748B]">
                    Immutable chronological ledger of operator actions, shipment status transitions, customs holds, and system configuration updates
                  </p>
                </div>
              </div>

              {/* 3-Column Audit Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-white border border-[#DCE4F0] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#64748B]">
                      Total Recorded Audit Events
                    </div>
                    <div className="text-[22px] font-extrabold text-[#072D59] tabular-nums mt-0.5">
                      {auditLogs.length}
                    </div>
                    <div className="text-[11px] text-[#475569] mt-0.5">
                      Verified SHA-256 append-only log
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#F0F7FF] border border-[#B8E2F8] text-[#072D59] flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-[#DCE4F0] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#64748B]">
                      Shipment & Checkpoint Actions
                    </div>
                    <div className="text-[22px] font-extrabold text-[#072D59] tabular-nums mt-0.5">
                      {
                        auditLogs.filter(
                          (l) =>
                            l.entity_type === 'Shipment' || l.entity_type === 'TrackingEvent'
                        ).length
                      }
                    </div>
                    <div className="text-[11px] text-[#475569] mt-0.5">
                      Lifecycle transitions & departures
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#F3FAF9] border border-[#BCE3E8] text-[#0D9488] flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-[#DCE4F0] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#64748B]">
                      Exception & Hold Incidents
                    </div>
                    <div className="text-[22px] font-extrabold text-[#9F1D35] tabular-nums mt-0.5">
                      {auditLogs.filter((l) => l.entity_type === 'ShipmentException').length}
                    </div>
                    <div className="text-[11px] text-[#475569] mt-0.5">
                      Customs holds, weather delays & resolutions
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#FFF0F3] border border-[#FD6E88]/60 text-[#9F1D35] flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar for Audit History */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'All Activity' },
                      { id: 'SHIPMENT', label: 'Shipment Updates' },
                      { id: 'EXCEPTION', label: 'Exceptions & Holds' },
                      { id: 'SETTINGS', label: 'System Config' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAuditCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        auditCategoryFilter === cat.id
                          ? 'bg-[#072D59] text-white'
                          : 'bg-[#F4F7FB] text-[#475569] hover:text-[#072D59]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[240px] sm:w-[300px]">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    placeholder="Search actor, DND-2026-..., or action..."
                    className="w-full bg-[#F8FAFC] border border-[#DCE4F0] focus:bg-white focus:border-[#072D59] focus:outline-none rounded-lg pl-9 pr-3 py-1.5 text-[12.5px]"
                  />
                </div>
              </div>

              {/* Clean, Well-Proportioned Audit Trail Cards / Rows */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl divide-y divide-[#E3E9F3] overflow-hidden shadow-2xs">
                {auditLogs
                  .filter((log) => {
                    if (auditCategoryFilter === 'SHIPMENT') {
                      if (log.entity_type !== 'Shipment' && log.entity_type !== 'TrackingEvent') {
                        return false;
                      }
                    } else if (auditCategoryFilter === 'EXCEPTION') {
                      if (log.entity_type !== 'ShipmentException') return false;
                    } else if (auditCategoryFilter === 'SETTINGS') {
                      if (log.entity_type !== 'Settings') return false;
                    }
                    if (auditSearchQuery.trim()) {
                      const q = auditSearchQuery.toLowerCase();
                      return (
                        log.actor_name.toLowerCase().includes(q) ||
                        log.entity_id.toLowerCase().includes(q) ||
                        log.action.toLowerCase().includes(q) ||
                        log.summary.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((log) => {
                    const matchedShipment = shipments.find(
                      (s) => s.shipment_number === log.entity_id
                    );
                    const isExceptionAction = log.entity_type === 'ShipmentException';
                    const isResolvedAction = log.action.includes('RESOLVED');
                    const isSettingsAction = log.entity_type === 'Settings';

                    const actionBadgeClass = isResolvedAction
                      ? 'bg-[#E5F3EC] text-[#2B6E51] border-[#B8E0CC]'
                      : isExceptionAction
                      ? 'bg-[#FFF0F3] text-[#9F1D35] border-[#FD6E88]/70'
                      : isSettingsAction
                      ? 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]'
                      : 'bg-[#DBF2FC] text-[#072D59] border-[#B8E2F8]';

                    const initials = log.actor_name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div
                        key={log.id}
                        className="p-4 hover:bg-[#F8FAFC] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        {/* Left + Center: Actor, Action Badge, Target Entity, and Full Summary */}
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-full bg-[#072D59] text-white font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                            {initials}
                          </div>

                          <div className="space-y-1 min-w-0 flex-1">
                            {/* Top Metadata Line (Single-Line Badges, Zero Vertical Wrapping) */}
                            <div className="flex flex-wrap items-center gap-2 text-[12px]">
                              <span className="font-bold text-[#072D59] whitespace-nowrap">
                                {log.actor_name}
                              </span>
                              <span className="text-[11px] font-semibold text-[#64748B] whitespace-nowrap">
                                ({formatEnumLabel(log.actor_role)})
                              </span>
                              <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${actionBadgeClass}`}
                              >
                                {formatEnumLabel(log.action)}
                              </span>
                              <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
                              <span className="font-mono-tabular text-[12px] font-bold text-[#072D59] whitespace-nowrap">
                                {log.entity_type}: {log.entity_id}
                              </span>
                            </div>

                            {/* Readable Full-Width Summary */}
                            <p className="text-[13px] text-[#1E293B] leading-relaxed">
                              {log.summary}
                            </p>
                          </div>
                        </div>

                        {/* Right: Timestamp & Quick Inspect Button */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pl-12 lg:pl-0">
                          <div className="text-left lg:text-right tabular-nums">
                            <div className="text-[12px] font-semibold text-[#334155] whitespace-nowrap">
                              {new Date(log.created_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[11px] text-[#64748B] whitespace-nowrap">
                              {new Date(log.created_at).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}{' '}
                              UTC
                            </div>
                          </div>

                          {matchedShipment && (
                            <button
                              type="button"
                              onClick={() => setSelectedShipment(matchedShipment)}
                              className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#072D59] text-[#072D59] hover:text-white border border-[#DCE4F0] hover:border-[#072D59] text-[11.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Inspect Shipment →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 10: CARRIERS MANAGEMENT (Admin Only)
          =================================================================== */}
          {activeSection === 'carriers' && isAdmin && (
            <div className="space-y-5">
              <div>
                <h1 className="text-[21px] font-bold text-[#072D59]">
                  Carriers & Multimodal Fleet Registry
                </h1>
                <p className="text-[13px] text-[#6B7A93]">
                  Each carrier operates a dedicated primary transport mode (Sea, Air, or Road)
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newCarrierCode || !newCarrierName) return;
                  const created: Carrier = {
                    id: carriers.length + 1,
                    code: newCarrierCode.toUpperCase(),
                    name: newCarrierName,
                    mode: newCarrierMode,
                    contact_email: `ops@${newCarrierCode.toLowerCase()}.example`,
                    fleet_summary: newCarrierFleet || 'Dedicated Multimodal Fleet',
                    active: true,
                  };
                  setCarriers((prev) => [...prev, created]);
                  setNewCarrierCode('');
                  setNewCarrierName('');
                  setNewCarrierFleet('');
                  showToast(`Registered ${created.mode} carrier ${created.name}.`);
                }}
                className="bg-white border border-[#E3E9F3] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-[12.5px]"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-[#243350] mb-1">
                    Carrier Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BML"
                    value={newCarrierCode}
                    onChange={(e) => setNewCarrierCode(e.target.value)}
                    className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#243350] mb-1">
                    Carrier Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Borneo Maritime Line"
                    value={newCarrierName}
                    onChange={(e) => setNewCarrierName(e.target.value)}
                    className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#243350] mb-1">
                    Operating Mode
                  </label>
                  <select
                    value={newCarrierMode}
                    onChange={(e) => setNewCarrierMode(e.target.value as TransportMode)}
                    className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                  >
                    <option value={TransportMode.SEA}>Sea Freight</option>
                    <option value={TransportMode.AIR}>Air Freight</option>
                    <option value={TransportMode.ROAD}>Road Freight</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#243350] mb-1">
                    Fleet Summary
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10 Container Ships"
                    value={newCarrierFleet}
                    onChange={(e) => setNewCarrierFleet(e.target.value)}
                    className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#072D59] text-white font-semibold hover:bg-[#051F3E]"
                >
                  + Add Carrier
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carriers.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white border border-[#E3E9F3] rounded-xl p-4 flex items-start gap-3"
                  >
                    <ModeIconChip mode={c.mode} size="lg" />
                    <div>
                      <div className="font-bold text-[#072D59] text-[14px]">
                        {c.name} ({c.code})
                      </div>
                      <div className="text-[12px] text-[#6B7A93]">{c.fleet_summary}</div>
                      <div className="text-[11px] text-[#072D59] mt-1">
                        {formatEnumLabel(c.mode)} Freight · {c.contact_email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 11: LOCATIONS & GEOCODING (Admin Only)
          =================================================================== */}
          {activeSection === 'locations' && isAdmin && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    Locations & Hubs Registry
                  </h1>
                  <p className="text-[13px] text-[#6B7A93]">
                    Register Seaports, Airports, and Road Depots with automatic Latitude & Longitude coordinate lookup and hub management
                  </p>
                </div>
                {locations.length < SEED_LOCATIONS.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocations(SEED_LOCATIONS);
                      showToast('Restored all default global logistics hubs.');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[12px] font-semibold text-[#072D59] hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    Restore Default Locations ({SEED_LOCATIONS.length})
                  </button>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newLocCode || !newLocName) return;
                  const nextLocId =
                    locations.length > 0 ? Math.max(...locations.map((l) => l.id)) + 1 : 1;
                  const created: Location = {
                    id: nextLocId,
                    code: newLocCode.toUpperCase(),
                    name: newLocName,
                    city: newLocCity || newLocName,
                    country: newLocCountry || 'Indonesia',
                    type: newLocType,
                    latitude: Number(newLocLat),
                    longitude: Number(newLocLng),
                  };
                  setLocations((prev) => [created, ...prev]);
                  setNewLocCode('');
                  setNewLocName('');
                  setNewLocCity('');
                  showToast(`Added ${formatEnumLabel(created.type)} location ${created.name} (${created.code}).`);
                }}
                className="bg-white border border-[#E3E9F3] rounded-xl p-5 space-y-4 text-[12.5px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#F1F5F9]">
                  <div>
                    <div className="font-bold text-[#072D59] text-[14px]">
                      Add New Logistics Hub Location
                    </div>
                    <div className="text-[11.5px] text-[#64748B]">
                      Enter a city or facility name and click <strong>Auto Latitude & Longitude</strong> to fill WGS84 coordinates automatically
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="auto-lat-lng-btn"
                    onClick={async () => {
                      const query = newLocCity || newLocName || newLocCode || 'Semarang';
                      setGeocodeStatus(`Looking up coordinates for "${query}"...`);
                      const res = await ExternalApiService.geocodePlaceName(query);
                      setNewLocLat(res.latitude);
                      setNewLocLng(res.longitude);
                      if (!newLocCity && res.city) setNewLocCity(res.city);
                      if (!newLocCountry && res.country) setNewLocCountry(res.country);
                      setGeocodeStatus(
                        `Auto Lat/Lng filled (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}) via ${res.source}: ${res.display_name}`
                      );
                      showToast(
                        `Auto Latitude & Longitude filled: ${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
                      );
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[12px] inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Auto Latitude & Longitude</span>
                  </button>
                </div>

                {/* Quick Hub Preset Chips for 1-Click Auto-Fill */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  <span className="text-[#64748B] font-semibold mr-1">Quick Auto-Fill Presets:</span>
                  {[
                    { code: 'IDSRG', name: 'Tanjung Emas Seaport', city: 'Semarang', country: 'Indonesia', type: LocationType.SEAPORT, lat: -6.9482, lng: 110.4239 },
                    { code: 'IDMAK', name: 'Soekarno-Hatta Seaport', city: 'Makassar', country: 'Indonesia', type: LocationType.SEAPORT, lat: -5.1189, lng: 119.4064 },
                    { code: 'IDBLW', name: 'Port of Belawan', city: 'Medan', country: 'Indonesia', type: LocationType.SEAPORT, lat: 3.7845, lng: 98.6894 },
                    { code: 'DPS', name: 'I Gusti Ngurah Rai Cargo Terminal', city: 'Denpasar', country: 'Indonesia', type: LocationType.AIRPORT, lat: -8.7482, lng: 115.2126 },
                    { code: 'BEANR', name: 'Port of Antwerp-Bruges', city: 'Antwerp', country: 'Belgium', type: LocationType.SEAPORT, lat: 51.2632, lng: 4.3679 },
                    { code: 'FRA', name: 'Frankfurt CargoCity Airport', city: 'Frankfurt', country: 'Germany', type: LocationType.AIRPORT, lat: 50.0379, lng: 8.5622 },
                  ].map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => {
                        setNewLocCode(preset.code);
                        setNewLocName(preset.name);
                        setNewLocCity(preset.city);
                        setNewLocCountry(preset.country);
                        setNewLocType(preset.type);
                        setNewLocLat(preset.lat);
                        setNewLocLng(preset.lng);
                        setGeocodeStatus(
                          `Preset loaded: ${preset.name} (${preset.city}) → Lat ${preset.lat}, Lng ${preset.lng}`
                        );
                      }}
                      className="px-2.5 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#DBF2FC] text-[#072D59] font-medium transition-colors cursor-pointer"
                    >
                      {preset.city} ({preset.code})
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      Location Code (UN/LOCODE or IATA)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IDSRG"
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      Facility Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tanjung Emas Port"
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      City (Geocode Target)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Semarang"
                        value={newLocCity}
                        onChange={(e) => setNewLocCity(e.target.value)}
                        className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const query = newLocCity || newLocName || newLocCode || 'Semarang';
                          setGeocodeStatus(`Querying coordinates for "${query}"...`);
                          const res = await ExternalApiService.geocodePlaceName(query);
                          setNewLocLat(res.latitude);
                          setNewLocLng(res.longitude);
                          if (!newLocCountry && res.country) setNewLocCountry(res.country);
                          setGeocodeStatus(`${res.source}: ${res.display_name}`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#DBF2FC] hover:bg-[#B8E2F8] text-[#072D59] font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Auto Lat/Lng
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      Facility Type
                    </label>
                    <select
                      value={newLocType}
                      onChange={(e) => setNewLocType(e.target.value as LocationType)}
                      className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5 bg-white"
                    >
                      <option value={LocationType.SEAPORT}>Seaport</option>
                      <option value={LocationType.AIRPORT}>Airport</option>
                      <option value={LocationType.DEPOT}>Road Depot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      Country
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Indonesia"
                      value={newLocCountry}
                      onChange={(e) => setNewLocCountry(e.target.value)}
                      className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      Latitude (WGS84)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newLocLat}
                      onChange={(e) => setNewLocLat(Number(e.target.value))}
                      className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5 tabular-nums font-semibold text-[#072D59]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#334155]">
                      Longitude (WGS84)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newLocLng}
                      onChange={(e) => setNewLocLng(Number(e.target.value))}
                      className="w-full border border-[#CBD5E1] rounded-lg px-3 py-1.5 tabular-nums font-semibold text-[#072D59]"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white font-semibold cursor-pointer"
                    >
                      + Save Location
                    </button>
                  </div>
                </div>
                {geocodeStatus && (
                  <div className="px-3 py-2 rounded-lg bg-[#F0F7FF] border border-[#BAE6FD] text-[12px] text-[#072D59] font-medium tabular-nums">
                    {geocodeStatus}
                  </div>
                )}
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="bg-white border border-[#E3E9F3] hover:border-[#CBD5E1] rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular font-bold text-[#072D59] text-[13.5px]">
                          {loc.code}
                        </span>
                        <LocationTypeBadge type={loc.type} />
                      </div>
                      <div className="font-bold text-[#1E293B] text-[13.5px]">
                        {loc.name}
                      </div>
                      <div className="text-[12px] text-[#64748B]">
                        {loc.city}, {loc.country}
                      </div>
                      <div className="text-[11.5px] tabular-nums font-medium text-[#072D59] bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E2E8F0] inline-block">
                        Lat {loc.latitude.toFixed(4)}, Lng {loc.longitude.toFixed(4)}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await ExternalApiService.geocodePlaceName(
                            `${loc.city} ${loc.country}`
                          );
                          setLocations((prev) =>
                            prev.map((item) =>
                              item.id === loc.id
                                ? { ...item, latitude: res.latitude, longitude: res.longitude }
                                : item
                            )
                          );
                          showToast(
                            `Updated ${loc.code} coordinates to Lat ${res.latitude.toFixed(4)}, Lng ${res.longitude.toFixed(4)}.`
                          );
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#DBF2FC] text-[#072D59] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Auto-refresh Latitude & Longitude for this location"
                      >
                        <Compass className="w-3 h-3" />
                        <span>Auto Lat/Lng</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`delete-location-${loc.code.toLowerCase()}`}
                        onClick={() => {
                          setLocations((prev) => prev.filter((item) => item.id !== loc.id));
                          setAuditLogs((prev) => [
                            {
                              id: Date.now(),
                              actor_user_id: currentUser.id,
                              actor_name: currentUser.name,
                              actor_role: currentUser.role,
                              action: 'LOCATION_DELETED',
                              entity_type: 'Location',
                              entity_id: loc.code,
                              summary: `Deleted ${formatEnumLabel(loc.type)} location ${loc.name} (${loc.code} · ${loc.city}).`,
                              old_values: { code: loc.code, name: loc.name, city: loc.city },
                              new_values: null,
                              created_at: new Date().toISOString(),
                            },
                            ...prev,
                          ]);
                          showToast(`Deleted location ${loc.name} (${loc.code}).`);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#FFF0F3] hover:bg-[#FFE4E9] text-[#9F1D35] border border-[#FECDD3] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title={`Delete ${loc.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus Location</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 12: SETTINGS & GROUP CONFIGURATION
          =================================================================== */}
          {activeSection === 'settings' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h1 className="text-[21px] font-bold text-[#072D59]">
                  Group Configuration & Delay Threshold Settings
                </h1>
                <p className="text-[13px] text-[#6B7A93]">
                  Configured for {settings.group_name}. Updating the delay threshold base immediately recalculates all dashboard KPIs and shipment delay evaluations across the workspace.
                </p>
              </div>

              <div className="bg-white border border-[#E3E9F3] rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <label
                      htmlFor="setting-delay-threshold"
                      className="block text-[12px] font-bold text-[#072D59] mb-1"
                    >
                      Group Delay Threshold Base (Hours)
                    </label>
                    <input
                      id="setting-delay-threshold"
                      type="number"
                      min={1}
                      max={120}
                      value={settings.delay_threshold_hours}
                      onChange={(e) => {
                        const nextVal = Math.max(1, Number(e.target.value));
                        const oldVal = settings.delay_threshold_hours;
                        setSettings((prev) => ({
                          ...prev,
                          delay_threshold_hours: nextVal,
                        }));
                        setAuditLogs((prev) => [
                          {
                            id: Date.now(),
                            actor_user_id: currentUser.id,
                            actor_name: currentUser.name,
                            actor_role: currentUser.role,
                            action: 'THRESHOLD_UPDATED',
                            entity_type: 'Settings',
                            entity_id: 'delay_threshold_hours',
                            summary: `Updated group delay threshold from ${oldVal}h to ${nextVal}h.`,
                            old_values: { delay_threshold_hours: oldVal },
                            new_values: { delay_threshold_hours: nextVal },
                            created_at: new Date().toISOString(),
                          },
                          ...prev,
                        ]);
                        showToast(
                          `Updated Group Delay Threshold to ${nextVal} hours. Dashboard KPIs recalculated.`
                        );
                      }}
                      className="w-full bg-[#F4F7FB] border border-[#072D59] rounded-lg px-3 py-2 tabular-nums font-bold text-[#072D59]"
                    />
                    <span className="text-[11px] text-[#6B7A93] mt-1 block">
                      Standard corridor presets: 12h (Group A), 18h (Group B), or 24h (Group C)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[#072D59] mb-1">
                      Corridor Threshold Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Group A (12h · SEA→EU)', hours: 12, grp: 'Group A', route: 'Southeast Asia → Europe' },
                        { label: 'Group B (18h · Asia→NA)', hours: 18, grp: 'Group B', route: 'Asia → North America' },
                        { label: 'Group C (24h · SEA→AU)', hours: 24, grp: 'Group C', route: 'Southeast Asia → Australia' },
                      ].map((preset) => (
                        <button
                          key={preset.grp}
                          type="button"
                          onClick={() => {
                            setSettings((prev) => ({
                              ...prev,
                              group_name: preset.grp,
                              delay_threshold_hours: preset.hours,
                              primary_route_focus: preset.route,
                            }));
                            showToast(`Applied ${preset.label} configuration.`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${
                            settings.delay_threshold_hours === preset.hours
                              ? 'bg-[#072D59] text-white border-[#072D59]'
                              : 'bg-[#DBF2FC]/50 text-[#072D59] border-[#B8E2F8]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E3E9F3] grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                  <div className="p-3 rounded-lg bg-[#F4F7FB] border border-[#E3E9F3]">
                    <span className="text-[#6B7A93] block">Minor Delay Window</span>
                    <strong className="tabular-nums text-[#072D59]">
                      0 – {settings.low_severity_max_hours} hours
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F4F7FB] border border-[#E3E9F3]">
                    <span className="text-[#6B7A93] block">Moderate Delay Window</span>
                    <strong className="tabular-nums text-[#072D59]">
                      &gt;{settings.low_severity_max_hours} – {settings.medium_severity_max_hours} hours
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FFF0F3] border border-[#FD6E88]">
                    <span className="text-[#9F1D35] block">Severe Delay Window</span>
                    <strong className="tabular-nums text-[#9F1D35]">
                      &gt;{settings.medium_severity_max_hours} hours
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 13: LARAVEL 12 + MYSQL 8.0 ARCHITECTURE & CODE OWNERSHIP GUIDE
          =================================================================== */}
          {activeSection === 'code_ownership' && (
            <div className="space-y-5 max-w-5xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-[#072D59]" />
                  <div>
                    <h1 className="text-[21px] font-bold text-[#072D59]">
                      Laravel 12 + MySQL 8.0 Architecture & Code Ownership Guide
                    </h1>
                    <p className="text-[13px] text-[#475569]">
                      Complete Laravel 12 MVC + Service Layer + Eloquent ORM + MySQL 8.0 reference for VPS deployment & UAS Code Interview (Slides 11–20)
                    </p>
                  </div>
                </div>

                <a
                  href="/api/database/sql-dump"
                  download="cargotrace_mysql_schema_and_seed.sql"
                  className="px-3.5 py-2 rounded-xl bg-[#072D59] hover:bg-[#0A3B73] text-white text-[12.5px] font-semibold inline-flex items-center gap-2 shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MySQL 8.0 Schema & Seed (.sql)</span>
                </a>
              </div>

              {/* Slide 15 Architecture Flow Pipeline */}
              <div className="bg-white border border-[#DCE4F0] rounded-2xl p-5 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14.5px] font-bold text-[#072D59]">
                    Laravel 12 Layered Architecture Pipeline (Brief Slide 14 & Slide 15)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#DBF2FC] text-[#072D59] text-[11px] font-bold">
                    PHP 8.3+ · Laravel 12 · MySQL 8.0 InnoDB · Sanctum
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-[12px]">
                  {[
                    {
                      step: '1. Browser & Blade',
                      path: 'resources/views/cargotrace/app.blade.php',
                      desc: 'Blade view + Tailwind CSS + Leaflet.js OpenStreetMap + Chart.js',
                    },
                    {
                      step: '2. Routes & Middleware',
                      path: 'routes/api.php · EnsureRolePermission.php',
                      desc: 'Laravel Sanctum Bearer auth + Server-side RBAC (401/403)',
                    },
                    {
                      step: '3. Controllers',
                      path: 'app/Http/Controllers/Api/*.php',
                      desc: 'Request validation (422), ShipmentPolicy checks, JSON pagination',
                    },
                    {
                      step: '4. Service Layer',
                      path: 'app/Services/{Shipment,Tracking,Eta,Exception}Service.php',
                      desc: 'Business rules, status state machine, deterministic ETA & DB::transaction',
                    },
                    {
                      step: '5. Models / Eloquent',
                      path: 'app/Models/*.php · MySQL 8.0',
                      desc: '9 Eloquent ORM models with belongsTo / hasMany & InnoDB foreign keys',
                    },
                  ].map((node) => (
                    <div
                      key={node.step}
                      className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE4F0] flex flex-col justify-between gap-1.5"
                    >
                      <div>
                        <div className="font-bold text-[#072D59] text-[12.5px]">{node.step}</div>
                        <div className="font-mono-tabular text-[10.5px] text-[#0284C7] font-semibold mt-0.5 break-all">
                          {node.path}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#475569] leading-snug">{node.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slide 11 MySQL 8.0 Relational Tables & Eloquent Models Directory */}
              <div className="bg-white border border-[#DCE4F0] rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[14.5px] font-bold text-[#072D59]">
                      MySQL 8.0 Schema & Laravel Eloquent Models (Brief Slide 11)
                    </h2>
                    <p className="text-[12px] text-[#475569]">
                      Defined in <code className="font-mono-tabular text-[#072D59] font-semibold">database/migrations/2026_11_01_000001_create_cargotrace_tables.php</code> &amp; <code className="font-mono-tabular text-[#072D59] font-semibold">database/mysql_schema_and_seed.sql</code>
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-[#F4F7FB] border-b border-[#DCE4F0] text-[#475569] text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-4 font-bold">MySQL Table</th>
                        <th className="py-2.5 px-3 font-bold">Eloquent Model</th>
                        <th className="py-2.5 px-3 font-bold">Cardinality & Foreign Keys</th>
                        <th className="py-2.5 px-4 font-bold">Purpose (Slide 11)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E9F3]">
                      {[
                        { table: 'users', model: 'App\\Models\\User', rel: 'hasMany(Shipment, Notification)', desc: 'Account credentials, password hash, & RBAC role (ADMIN, OPERATOR, CUSTOMER)' },
                        { table: 'carriers', model: 'App\\Models\\Carrier', rel: 'hasMany(Shipment)', desc: 'Logistics operator master data scoped to SEA, AIR, or ROAD mode' },
                        { table: 'locations', model: 'App\\Models\\Location', rel: 'hasMany(Shipment origin/dest)', desc: 'Origin & destination hubs (SEAPORT, AIRPORT, DEPOT) with WGS84 coordinates' },
                        { table: 'shipments', model: 'App\\Models\\Shipment', rel: 'belongsTo(User, Carrier, Location) · hasMany(TrackingEvent, ShipmentItem, ShipmentException)', desc: 'Core shipment header, lifecycle status, expected/estimated arrival, weight/volume' },
                        { table: 'shipment_items', model: 'App\\Models\\ShipmentItem', rel: 'belongsTo(Shipment) [CASCADE]', desc: 'Cargo manifest line items, SKU, quantity, HS code, weight & volume' },
                        { table: 'tracking_events', model: 'App\\Models\\TrackingEvent', rel: 'belongsTo(Shipment, Location, User)', desc: 'Append-only chronological journey checkpoints & coordinates (never overwritten)' },
                        { table: 'shipment_exceptions', model: 'App\\Models\\ShipmentException', rel: 'belongsTo(Shipment, User)', desc: 'Customs hold, weather delay, port congestion, severity & resolution timestamps' },
                        { table: 'notifications', model: 'App\\Models\\Notification', rel: 'belongsTo(User, Shipment)', desc: 'In-app customer & operator alerts for status updates and delay exceptions' },
                        { table: 'audit_logs', model: 'App\\Models\\AuditLog', rel: 'belongsTo(User actor)', desc: 'Immutable trail recording actor, action, timestamp, and related entity' },
                      ].map((row) => (
                        <tr key={row.table} className="hover:bg-[#F8FAFC]">
                          <td className="py-2.5 px-4 font-mono-tabular font-bold text-[#072D59]">{row.table}</td>
                          <td className="py-2.5 px-3 font-mono-tabular text-[#0284C7] font-semibold">{row.model}</td>
                          <td className="py-2.5 px-3 text-[#334155] font-medium">{row.rel}</td>
                          <td className="py-2.5 px-4 text-[#475569]">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VPS Deployment Quick-Start Commands */}
              <div className="bg-white border border-[#DCE4F0] rounded-2xl p-5 space-y-3 shadow-2xs">
                <h2 className="text-[14.5px] font-bold text-[#072D59]">
                  VPS Deployment Commands (Ubuntu + MySQL 8.0 + Laravel 12 / Docker Compose)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                  <div className="p-3.5 rounded-xl bg-[#0F172A] text-[#E2E8F0] font-mono-tabular space-y-1">
                    <div className="text-[#38BDF8] font-bold mb-1"># Option 1: Native Laravel 12 + MySQL 8.0 on VPS</div>
                    <div>mysql -u root -p -e &quot;CREATE DATABASE cargotrace_db;&quot;</div>
                    <div>mysql -u root -p cargotrace_db &lt; database/mysql_schema_and_seed.sql</div>
                    <div>cp .env.example .env &amp;&amp; composer install</div>
                    <div>php artisan key:generate &amp;&amp; php artisan migrate --seed</div>
                    <div>npm install &amp;&amp; npm run build</div>
                    <div>php artisan serve --host=0.0.0.0 --port=8000</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0F172A] text-[#E2E8F0] font-mono-tabular space-y-1">
                    <div className="text-[#38BDF8] font-bold mb-1"># Option 2: 1-Command Docker Compose on VPS</div>
                    <div>cp .env.example .env</div>
                    <div>docker compose up -d --build</div>
                    <div className="text-[#94A3B8] pt-1"># Run PHPUnit Feature Tests (Brief Slide 16):</div>
                    <div>php artisan test --filter=CargoTraceApiTest</div>
                  </div>
                </div>
              </div>

              {/* Lecturer Q&A Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    q: '1. Why is Shipment → TrackingEvent a hasMany (1:N) relationship?',
                    a: 'A single Shipment moves through multiple checkpoints over time (CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED). Each checkpoint is an immutable historical record in tracking_events with its own timestamp, coordinates, and operator actor. Overwriting a single column on shipments would destroy the audit trail required by Slide 7.',
                  },
                  {
                    q: '2. How do we prevent invalid status transitions (e.g., DELIVERED → IN_TRANSIT)?',
                    a: 'In App\\Services\\ShipmentService::validateTransition(), each status maps strictly to its allowed next state. Terminal status DELIVERED maps to an empty array [], throwing a 422 ValidationException if any caller tries to revert or skip states.',
                  },
                  {
                    q: '3. How does the Multimodal (SEA / AIR / ROAD) validation rule work?',
                    a: 'In App\\Services\\ShipmentService::validateMultimodalCompatibility(), we check two invariants before DB::transaction(): (1) Carrier->mode must equal Shipment->mode, and (2) Origin and Destination location types must match the mode (SEA requires SEAPORT; AIR requires AIRPORT; ROAD requires DEPOT).',
                  },
                  {
                    q: '4. How do you change the delay threshold live during the interview?',
                    a: 'The delay threshold is never hardcoded in App\\Services\\EtaService. It is stored in config/cargotrace.php (CARGOTRACE_DELAY_THRESHOLD_HOURS=12) and the group_settings table. Updating the threshold immediately recalculates LOW (0–6h), MEDIUM (>6–24h), HIGH (>24h), and threshold exceedance.',
                  },
                  {
                    q: '5. How is Customer data isolation enforced on the server?',
                    a: 'Hiding buttons in the UI is never sufficient (Slide 5 & 13). App\\Policies\\ShipmentPolicy::view() and ShipmentController::index() enforce $user->isCustomer() ? $query->where("customer_id", $user->id) : $query on the server, returning HTTP 403 Forbidden if a customer requests another customer’s shipment.',
                  },
                  {
                    q: '6. How do external APIs (Open-Meteo & Nominatim) handle timeouts or failures?',
                    a: 'App\\Services\\ExternalTelemetryService uses Laravel HTTP Client (Http::timeout(4)->get(...)) inside a try/catch block. If Open-Meteo or Nominatim times out or returns an empty response, it gracefully returns fallback telemetry without crashing the request (Slide 9).',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-[#E3E9F3] rounded-xl p-4 space-y-2"
                  >
                    <h3 className="text-[13.5px] font-bold text-[#072D59]">{item.q}</h3>
                    <p className="text-[12.5px] text-[#243350] leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SHIPMENT DETAIL DRAWER & TIMELINE MODAL */}
      <ShipmentDetailModal
        shipment={selectedShipment}
        currentUser={currentUser}
        locations={locations}
        carriers={carriers}
        items={shipmentItems}
        events={trackingEvents}
        exceptions={exceptions}
        settings={settings}
        onClose={() => setSelectedShipment(null)}
        onAddTrackingEvent={handleAddTrackingEvent}
        onReportException={handleReportException}
        onResolveException={handleResolveException}
      />

      {/* CREATE NEW SHIPMENT MODAL */}
      <NewShipmentModal
        isOpen={isNewShipmentOpen}
        onClose={() => setIsNewShipmentOpen(false)}
        carriers={carriers}
        locations={locations}
        customers={users}
        onCreateShipment={handleCreateShipment}
      />
    </div>
  );
};

export default App;
