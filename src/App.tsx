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
  const [trackingLookupInput, setTrackingLookupInput] = useState('CT-2026-000101');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
          const q = searchQuery.toLowerCase().trim();
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

      rows.push({
        route_code: first.route_code,
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
    const shipmentNumber = `CT-2026-000${nextId}`;
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
          sidebarCollapsed ? 'w-[68px]' : 'w-[244px]'
        } h-screen overflow-y-auto bg-white border-r border-[#DCE4F0] flex flex-col justify-between shrink-0 transition-all duration-200 select-none`}
      >
        {/* Top Workspace Header — No dead chevron next to CargoTrace */}
        <div>
          <div className="h-[56px] px-3.5 border-b border-[#DCE4F0] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className="flex items-center gap-2.5 overflow-hidden text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#072D59] text-[#DBF2FC] flex items-center justify-center font-bold text-xs shrink-0">
                <Anchor className="w-4 h-4" />
              </div>
              {!sidebarCollapsed && (
                <span className="font-bold text-[15px] text-[#072D59] tracking-tight truncate">
                  CargoTrace
                </span>
              )}
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
        {/* TOP BAR — Clean unboxed breadcrumb & timestamp on left, primary action on right */}
        <header className="h-[56px] bg-white border-b border-[#DCE4F0] px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Clean Breadcrumb + Unboxed Operational Date/Time */}
          <div className="flex items-center gap-3 text-[13px] min-w-0">
            <span className="font-semibold text-[#072D59] truncate">
              {SECTION_LABELS[activeSection]}
            </span>
            <span className="text-[#CBD5E1]" aria-hidden="true">/</span>
            <span className="text-[#475569] tabular-nums whitespace-nowrap">
              {serverClock} UTC
            </span>
          </div>

          {/* Right: User Context + Primary Action Button + Sign Out */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-[12.5px] text-[#475569]">
              <span className="font-semibold text-[#072D59]">{currentUser.name}</span>
              <span aria-hidden="true">·</span>
              <span>{currentUser.company_name}</span>
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => setIsNewShipmentOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white text-[12.5px] font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New shipment</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] text-[#475569] hover:text-[#072D59] hover:bg-[#F8FAFC] text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl bg-[#072D59] text-white text-[12.5px] font-medium flex items-center justify-between shadow-md">
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
              SECTION 1: LOGISTICS OVERVIEW DASHBOARD
          =================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-3.5">
              {/* Page Header */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59] tracking-tight">
                    Logistics Overview
                  </h1>
                  <p className="text-[13px] text-[#475569]">
                    Track multimodal shipments ({settings.primary_route_focus}), delay threshold ({settings.delay_threshold_hours}h), and delivery performance
                  </p>
                </div>
                <div className="text-[12.5px] text-[#475569] tabular-nums">
                  {settings.group_name} · Primary KPI: <strong className="text-[#072D59]">{settings.group_kpi_label} ({kpiMetrics.onTimeRate}%)</strong>
                </div>
              </div>

              {/* Row of 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiStatCard
                  percentage={kpiMetrics.onTimeRate}
                  barColorHex="#072D59"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="On-Time Delivery"
                  primaryValue={`${kpiMetrics.onTimeCount}/${kpiMetrics.total}`}
                  unitLabel="Shipped"
                  subtitleNote="Group KPI · Target ≥ 85%"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setActiveSection('shipments');
                  }}
                />

                <KpiStatCard
                  percentage={kpiMetrics.inTransitRate}
                  barColorHex="#3AA0AB"
                  icon={<Navigation className="w-4 h-4" />}
                  label="In Transit"
                  primaryValue={`${kpiMetrics.inTransit}/${kpiMetrics.total}`}
                  unitLabel="Active"
                  subtitleNote="Sea, Air & Road active corridors"
                  onClick={() => {
                    setStatusFilter(ShipmentStatus.IN_TRANSIT);
                    setActiveSection('shipments');
                  }}
                />

                <KpiStatCard
                  percentage={kpiMetrics.delayedRate}
                  barColorHex="#FD6E88"
                  icon={<Clock className="w-4 h-4 text-[#FD6E88]" />}
                  label="Delayed Shipments"
                  primaryValue={`${kpiMetrics.delayedCount}/${kpiMetrics.total}`}
                  unitLabel="Delayed"
                  subtitleNote={`${kpiMetrics.thresholdExceededCount} exceed ${settings.delay_threshold_hours}h threshold`}
                  onClick={() => {
                    setStatusFilter('DELAYED');
                    setActiveSection('shipments');
                  }}
                />

                <KpiStatCard
                  percentage={kpiMetrics.openExceptionRate}
                  barColorHex="#3E6FB4"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Open Exceptions"
                  primaryValue={`${kpiMetrics.openExceptions}/${kpiMetrics.totalExceptions}`}
                  unitLabel="Open Holds"
                  subtitleNote={`Primary focus: ${formatEnumLabel(settings.main_exception_focus)}`}
                  onClick={() => setActiveSection('exceptions')}
                />
              </div>

              {/* Toolbar Row */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
                  <select
                    aria-label="Filter by transport mode"
                    value={modeFilter}
                    onChange={(e) => {
                      setModeFilter(e.target.value as 'ALL' | TransportMode);
                      setCurrentPage(1);
                    }}
                    className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#072D59] focus:outline-none focus:border-[#072D59]"
                  >
                    <option value="ALL">All Modes</option>
                    <option value={TransportMode.SEA}>Sea Freight (SEA)</option>
                    <option value={TransportMode.AIR}>Air Freight (AIR)</option>
                    <option value={TransportMode.ROAD}>Road Freight (ROAD)</option>
                  </select>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      aria-label="Search shipments, routes, carriers, or cities"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search shipment CT-2026-..., route, carrier, city..."
                      className="w-full bg-[#F8FAFC] border border-[#DCE4F0] rounded-lg pl-9 pr-3 py-1.5 text-[12.5px] text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#072D59]"
                    />
                  </div>
                </div>

                {/* Segmented Time-Range Control */}
                <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-[#DCE4F0]">
                  {(['15m', '1h', '24h', '3d', '7d', 'all'] as TimeRangeSegment[]).map(
                    (seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => setTimeSegment(seg)}
                        className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors tabular-nums uppercase ${
                          timeSegment === seg
                            ? 'bg-[#072D59] text-white shadow-2xs'
                            : 'text-[#475569] hover:text-[#072D59]'
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

              {/* Popular Routes Table Card */}
              <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#DCE4F0] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-[#072D59]">
                      Popular routes
                    </h2>
                    <p className="text-[12.5px] text-[#475569]">
                      Ranked by shipment volume · November 2026 ({popularRoutes.length} active corridors)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-[#F8FAFC] text-[#072D59] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>

                {popularRoutes.length === 0 ? (
                  <div className="p-10 text-center text-[#6B7A93] text-[13px]">
                    No routes match the current filter criteria. Try resetting the mode or time range filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12.5px]">
                      <thead>
                        <tr className="border-b border-[#E3E9F3] text-[#6B7A93] text-[11px] bg-[#F4F7FB]/60">
                          <th className="py-2.5 px-4 font-medium">Route</th>
                          <th className="py-2.5 px-3 font-medium">Carrier / vehicle</th>
                          <th className="py-2.5 px-3 font-medium">Status</th>
                          <th className="py-2.5 px-3 font-medium">Mode</th>
                          <th className="py-2.5 px-3 font-medium">Distance</th>
                          <th className="py-2.5 px-3 font-medium text-right">Shipments</th>
                          <th className="py-2.5 px-3 font-medium text-right">Avg. transit</th>
                          <th className="py-2.5 px-4 font-medium text-right">On-time rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E9F3]">
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
                              className="hover:bg-[#DBF2FC]/35 cursor-pointer transition-colors"
                            >
                              {/* Route Column (Initials badge + Origin To Destination + route code) */}
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-[#DBF2FC] text-[#072D59] font-bold text-[11.5px] flex items-center justify-center shrink-0 border border-[#B8E2F8]">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-[#072D59] whitespace-nowrap">
                                      {row.origin.city}{' '}
                                      <span className="text-[#6B7A93] font-normal">To</span>{' '}
                                      {row.destination.city}
                                    </div>
                                    <div className="text-[11px] text-[#6B7A93] font-mono-tabular">
                                      {row.route_code} · {row.origin.code} → {row.destination.code}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Carrier / Vehicle Column (Mode icon chip + carrier name + vehicle model) */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <ModeIconChip mode={row.mode} size="sm" />
                                  <div>
                                    <div className="font-semibold text-[#072D59] whitespace-nowrap">
                                      {row.carrier.name}
                                    </div>
                                    <div className="text-[11px] text-[#6B7A93] font-mono-tabular">
                                      {row.vehicle_ref}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="py-2.5 px-3">
                                <ShipmentStatusBadge
                                  status={row.representative_status}
                                  isDelayed={row.is_delayed}
                                />
                              </td>

                              {/* Mode */}
                              <td className="py-2.5 px-3 whitespace-nowrap text-[12px] text-[#6B7A93]">
                                <strong className="text-[#072D59]">{row.mode}</strong> · {row.mode_label}
                              </td>

                              {/* Distance (Haversine approx) */}
                              <td className="py-2.5 px-3 font-mono-tabular font-semibold text-[#072D59] whitespace-nowrap">
                                {row.distance_mi.toLocaleString()} mi
                                <span className="block text-[10px] font-normal text-[#6B7A93]">
                                  ({row.distance_km.toLocaleString()} km)
                                </span>
                              </td>

                              {/* Shipments Count */}
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#072D59]">
                                {row.shipment_count}
                              </td>

                              {/* Avg Transit */}
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#243350] whitespace-nowrap">
                                {row.avg_transit_days} days
                              </td>

                              {/* On-Time Rate */}
                              <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#072D59]">
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
                  Look up any shipment by reference number (e.g. CT-2026-000101) to inspect chronological events, current location, and deterministic ETA rules
                </p>
              </div>

              <div className="bg-white border border-[#E3E9F3] rounded-xl p-5 space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const found = roleScopedShipments.find(
                      (s) =>
                        s.shipment_number.toLowerCase() ===
                        trackingLookupInput.trim().toLowerCase()
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
                      placeholder="Enter Shipment Number (e.g. CT-2026-000101, CT-2026-000201, CT-2026-000301)..."
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    Shipments Directory
                  </h1>
                  <p className="text-[13px] text-[#6B7A93]">
                    Full operational shipments ledger with multimodal filtering, status filter, and server-style pagination
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 rounded-lg border border-[#E3E9F3] bg-white hover:bg-[#DBF2FC]/50 text-[#072D59] text-[12px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() => setIsNewShipmentOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#072D59] text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New shipment</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Bar */}
              <div className="bg-white border border-[#E3E9F3] rounded-xl p-3 flex flex-wrap items-center gap-3">
                <select
                  aria-label="Filter shipments by mode"
                  value={modeFilter}
                  onChange={(e) => {
                    setModeFilter(e.target.value as 'ALL' | TransportMode);
                    setCurrentPage(1);
                  }}
                  className="bg-[#F4F7FB] border border-[#E3E9F3] rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#072D59]"
                >
                  <option value="ALL">All Modes (Sea / Air / Road)</option>
                  <option value={TransportMode.SEA}>Sea Freight</option>
                  <option value={TransportMode.AIR}>Air Freight</option>
                  <option value={TransportMode.ROAD}>Road Freight</option>
                </select>

                <select
                  aria-label="Filter shipments by status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as 'ALL' | ShipmentStatus | 'DELAYED');
                    setCurrentPage(1);
                  }}
                  className="bg-[#F4F7FB] border border-[#E3E9F3] rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#072D59]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DELAYED">Delayed Only (ETA &gt; Expected)</option>
                  {Object.values(ShipmentStatus).map((st) => (
                    <option key={st} value={st}>
                      {formatEnumLabel(st)}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-[#6B7A93] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by CT-2026-..., customer, vehicle, cargo, port..."
                    className="w-full bg-[#F4F7FB] border border-[#E3E9F3] rounded-lg pl-9 pr-3 py-1.5 text-[12.5px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSortField((f) =>
                      f === 'expected_arrival' ? 'shipment_number' : 'expected_arrival'
                    );
                    setSortAsc((a) => !a);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E3E9F3] bg-[#F4F7FB] text-[12px] font-medium text-[#243350] inline-flex items-center gap-1.5"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#072D59]" />
                  <span>Sort: {sortField === 'expected_arrival' ? 'Arrival Date' : 'Shipment #'}</span>
                </button>
              </div>

              {/* Shipments Table */}
              <div className="bg-white border border-[#E3E9F3] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-[#F4F7FB] border-b border-[#E3E9F3] text-[#6B7A93] text-[11.5px]">
                        <th className="py-3 px-4 font-medium">Shipment #</th>
                        <th className="py-3 px-4 font-medium">Origin → Destination</th>
                        <th className="py-3 px-4 font-medium">Carrier / Vehicle</th>
                        <th className="py-3 px-4 font-medium">Customer</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">ETA & Schedule</th>
                        <th className="py-3 px-4 font-medium text-right">Weight</th>
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
                            className="hover:bg-[#DBF2FC]/35 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4 font-mono-tabular font-bold text-[#072D59] whitespace-nowrap">
                              {sh.shipment_number}
                              <span className="block text-[10.5px] font-sans font-normal text-[#6B7A93]">
                                {sh.cargo_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-semibold text-[#243350]">
                                {orig?.city} ({orig?.code}) → {dest?.city} ({dest?.code})
                              </div>
                              <div className="text-[11px] text-[#6B7A93]">
                                {orig ? formatEnumLabel(orig.type) : ''} to {dest ? formatEnumLabel(dest.type) : ''}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <ModeIconChip mode={sh.mode} size="sm" />
                                <div>
                                  <div className="font-semibold text-[#072D59]">
                                    {car?.name}
                                  </div>
                                  <div className="text-[11px] text-[#6B7A93] tabular-nums">
                                    {sh.vehicle_ref}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[#243350] whitespace-nowrap">
                              {sh.customer_name}
                            </td>
                            <td className="py-3 px-4">
                              <ShipmentStatusBadge
                                status={sh.status}
                                isDelayed={isDelayed}
                              />
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="tabular-nums font-medium text-[12px] text-[#072D59]">
                                {new Date(sh.estimated_arrival).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <SeverityBadge severity={eta.severity} />
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#072D59] whitespace-nowrap">
                              {sh.total_weight_kg.toLocaleString()} kg
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="px-4 py-3 bg-[#F4F7FB] border-t border-[#E3E9F3] flex items-center justify-between text-[12px]">
                  <span className="text-[#6B7A93]">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filteredShipments.length)} of{' '}
                    <strong className="text-[#072D59]">{filteredShipments.length}</strong> shipments
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-md border border-[#E3E9F3] bg-white disabled:opacity-40 font-semibold text-[#072D59]"
                    >
                      Previous
                    </button>
                    <span className="px-2 tabular-nums">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-md border border-[#E3E9F3] bg-white disabled:opacity-40 font-semibold text-[#072D59]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 4: ACTIVE ROUTES (Leaflet.js + OpenStreetMap + Layer Toggle)
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
              <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E3E9F3] flex items-center justify-between">
                  <div>
                    <h2 className="text-[14.5px] font-bold text-[#072D59]">
                      Active Corridor Shipments Directory
                    </h2>
                    <p className="text-[12px] text-[#475569]">
                      Click any shipment row below to inspect its chronological checkpoints, destination weather, and route polyline
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E3E9F3] text-[#475569] text-[11.5px] bg-[#F4F7FB]/70">
                        <th className="py-2.5 px-4 font-semibold">Shipment #</th>
                        <th className="py-2.5 px-4 font-semibold">Mode & Carrier</th>
                        <th className="py-2.5 px-4 font-semibold">Origin → Destination</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                        <th className="py-2.5 px-4 font-semibold">Schedule Variance</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Action</th>
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
                            <td className="py-3 px-4 font-mono-tabular font-bold text-[#072D59] whitespace-nowrap">
                              {sh.shipment_number}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <ModeIconChip mode={sh.mode} size="sm" />
                                <div>
                                  <div className="font-semibold text-[#072D59] whitespace-nowrap">{car?.name}</div>
                                  <div className="text-[11px] tabular-nums text-[#475569] whitespace-nowrap">
                                    {sh.vehicle_ref}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-[#1E293B] whitespace-nowrap">
                              {orig?.city} ({orig?.code}) → {dest?.city} ({dest?.code})
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <ShipmentStatusBadge
                                status={sh.status}
                                isDelayed={eta.is_delayed && sh.status !== ShipmentStatus.DELIVERED}
                              />
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <SeverityBadge severity={eta.severity} />
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-[#072D59] whitespace-nowrap">
                              Open Details →
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
                  <p className="text-[13px] text-[#6B7A93]">
                    Aggregated route performance ranked by shipment volume, haversine distance, and on-time rate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-1.5 rounded-lg bg-[#072D59] text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Routes CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {popularRoutes.map((r) => (
                  <div
                    key={`${r.route_code}-${r.mode}`}
                    onClick={() => {
                      const sh = shipments.find((s) => s.id === r.sample_shipment_id);
                      if (sh) setSelectedShipment(sh);
                    }}
                    className="bg-white border border-[#E3E9F3] hover:border-[#072D59] rounded-xl p-4 cursor-pointer transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <ModeIconChip mode={r.mode} size="md" showLabel />
                      <span className="tabular-nums text-[12px] font-semibold text-[#475569]">
                        {r.shipment_count} Shipments
                      </span>
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#072D59]">
                        {r.origin.city} ({r.origin.code}) → {r.destination.city} ({r.destination.code})
                      </div>
                      <div className="text-[11.5px] text-[#6B7A93]">
                        {r.carrier.name} · {r.vehicle_ref}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E3E9F3] text-[11.5px] tabular-nums">
                      <div>
                        <span className="text-[#6B7A93] block text-[10px]">Distance</span>
                        <strong className="text-[#072D59]">{r.distance_mi.toLocaleString()} mi</strong>
                      </div>
                      <div>
                        <span className="text-[#6B7A93] block text-[10px]">Avg Transit</span>
                        <strong className="text-[#072D59]">{r.avg_transit_days}d</strong>
                      </div>
                      <div>
                        <span className="text-[#6B7A93] block text-[10px]">On-Time</span>
                        <strong className="text-[#072D59]">{r.on_time_rate}%</strong>
                      </div>
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
          {activeSection === 'history' && isAdmin && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[21px] font-bold text-[#072D59]">
                  System Audit Trail
                </h1>
                <p className="text-[13px] text-[#6B7A93]">
                  Immutable record of user actions, timestamps, and state changes across shipments, exceptions, and settings
                </p>
              </div>

              <div className="bg-white border border-[#E3E9F3] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#F4F7FB] border-b border-[#E3E9F3] text-[#6B7A93] text-[11.5px]">
                      <th className="py-3 px-4 font-medium">Timestamp (UTC)</th>
                      <th className="py-3 px-4 font-medium">Actor</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Entity</th>
                      <th className="py-3 px-4 font-medium">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E9F3]">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 px-4 tabular-nums text-[11.5px] text-[#6B7A93] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('en-GB')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[#072D59]">{log.actor_name}</div>
                          <div className="text-[11px] text-[#6B7A93]">{formatEnumLabel(log.actor_role)}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[12px] text-[#072D59]">
                          {formatEnumLabel(log.action)}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-[#243350]">
                          {log.entity_type} · {log.entity_id}
                        </td>
                        <td className="py-3 px-4 text-[#243350]">
                          <div>{log.summary}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div>
                <h1 className="text-[21px] font-bold text-[#072D59]">
                  Locations Registry & Nominatim Geocoding
                </h1>
                <p className="text-[13px] text-[#6B7A93]">
                  Register Seaports, Airports, and Road Depots with OpenStreetMap Nominatim coordinate lookup
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newLocCode || !newLocName) return;
                  const created: Location = {
                    id: locations.length + 1,
                    code: newLocCode.toUpperCase(),
                    name: newLocName,
                    city: newLocCity || newLocName,
                    country: newLocCountry || 'Indonesia',
                    type: newLocType,
                    latitude: Number(newLocLat),
                    longitude: Number(newLocLng),
                  };
                  setLocations((prev) => [...prev, created]);
                  setNewLocCode('');
                  setNewLocName('');
                  setNewLocCity('');
                  showToast(`Added ${formatEnumLabel(created.type)} location ${created.name} (${created.code}).`);
                }}
                className="bg-white border border-[#E3E9F3] rounded-xl p-4 space-y-3 text-[12.5px]"
              >
                <div className="font-bold text-[#072D59] text-[13.5px]">
                  Add Logistics Hub Location
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      Location Code (UN/LOCODE or IATA)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IDSRG"
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      Facility Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tanjung Emas Port"
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      City (Geocode WGS84)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Semarang"
                        value={newLocCity}
                        onChange={(e) => setNewLocCity(e.target.value)}
                        className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setGeocodeStatus('Querying Nominatim...');
                          const res = await ExternalApiService.geocodePlaceName(
                            newLocCity || newLocName
                          );
                          setNewLocLat(res.latitude);
                          setNewLocLng(res.longitude);
                          setGeocodeStatus(`${res.source}: ${res.display_name}`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#DBF2FC] text-[#072D59] font-semibold text-xs shrink-0"
                      >
                        Geocode
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      Facility Type
                    </label>
                    <select
                      value={newLocType}
                      onChange={(e) => setNewLocType(e.target.value as LocationType)}
                      className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                    >
                      <option value={LocationType.SEAPORT}>Seaport</option>
                      <option value={LocationType.AIRPORT}>Airport</option>
                      <option value={LocationType.DEPOT}>Road Depot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Indonesia"
                      value={newLocCountry}
                      onChange={(e) => setNewLocCountry(e.target.value)}
                      className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      Latitude (WGS84)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newLocLat}
                      onChange={(e) => setNewLocLat(Number(e.target.value))}
                      className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      Longitude (WGS84)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newLocLng}
                      onChange={(e) => setNewLocLng(Number(e.target.value))}
                      className="w-full border border-[#E3E9F3] rounded-lg px-3 py-1.5 tabular-nums"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-lg bg-[#072D59] text-white font-semibold"
                    >
                      + Save Location
                    </button>
                  </div>
                </div>
                {geocodeStatus && (
                  <div className="text-[11.5px] text-[#072D59] tabular-nums">
                    {geocodeStatus}
                  </div>
                )}
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="bg-white border border-[#E3E9F3] rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular font-bold text-[#072D59]">
                        {loc.code}
                      </span>
                      <LocationTypeBadge type={loc.type} />
                    </div>
                    <div className="font-semibold text-[#243350] text-[13.5px]">
                      {loc.name}
                    </div>
                    <div className="text-[12px] text-[#6B7A93]">
                      {loc.city}, {loc.country}
                    </div>
                    <div className="text-[11px] tabular-nums text-[#6B7A93]">
                      Lat {loc.latitude.toFixed(4)}, Lng {loc.longitude.toFixed(4)}
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
              SECTION 13: CODE OWNERSHIP & INTERVIEW Q&A GUIDE (Slide 19 & 20)
          =================================================================== */}
          {activeSection === 'code_ownership' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#072D59]" />
                <div>
                  <h1 className="text-[21px] font-bold text-[#072D59]">
                    Code Ownership Interview Guide & Architecture Reference
                  </h1>
                  <p className="text-[13px] text-[#6B7A93]">
                    Prepared for Web Programming 2 UAS Live Demo & Code Interview (Slides 15, 19, 20)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    q: '1. Why is Shipment → TrackingEvent a hasMany (1:N) relationship?',
                    a: 'A single Shipment moves through multiple checkpoints over time (CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED). Each checkpoint is an immutable historical record in tracking_events with its own timestamp, coordinates, and operator actor. Overwriting a single column on shipments would destroy the audit trail required by Slide 7.',
                  },
                  {
                    q: '2. How do we prevent invalid status transitions (e.g., CREATED → DELIVERED)?',
                    a: 'In ShipmentService::validateStatusTransition (and VALID_STATUS_TRANSITIONS), each status maps strictly to its allowed next state. Terminal status DELIVERED maps to an empty array [], returning HTTP 422 Unprocessable Entity if any caller tries to revert or skip states.',
                  },
                  {
                    q: '3. How does the Multimodal (SEA / AIR / ROAD) validation rule work?',
                    a: 'In ShipmentService::validateShipmentPayload (and StoreShipmentRequest), we check two invariants: (1) Carrier.mode must equal Shipment.mode, and (2) Origin and Destination location types must match the mode (SEA requires SEAPORTs; AIR requires AIRPORTs; ROAD allows DEPOT, SEAPORT, or AIRPORT).',
                  },
                  {
                    q: '4. How do you change the delay threshold live during the interview?',
                    a: 'The delay threshold is never hardcoded in EtaService. It is stored in configuration/settings (config/cargotrace.php and the settings table). EtaService::evaluate() accepts the settings object and compares delayHours >= settings.delay_threshold_hours.',
                  },
                  {
                    q: '5. How is Customer data isolation enforced on the server?',
                    a: 'Hiding buttons in the UI is never sufficient (Slide 5 & 13). ShipmentPolicy::view() and AuthPolicyService::canViewShipment() verify $user->role !== CUSTOMER || $shipment->customer_id === $user->id on every query and endpoint, returning 403 Forbidden if a customer requests another customer’s shipment.',
                  },
                  {
                    q: '6. How do external APIs (Open-Meteo & Nominatim) handle timeouts or failures?',
                    a: 'ExternalApiService wraps requests with a 3-second timeout and try/catch fallback. If the external service times out or returns an error, the system serves cached operational weather or allows manual WGS84 coordinate entry without crashing the page (Slide 9).',
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
