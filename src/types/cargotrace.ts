// CargoTrace Domain Types & Enums (Mirroring Laravel 12 Backed Enums & Database Schema)
// Reference: CargoTrace_UAS_Final_Project_Brief_2.pdf (Slides 5, 6, 7, 8, 11, 12, 15)

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  CUSTOMER = 'CUSTOMER',
}

export enum TransportMode {
  SEA = 'SEA',
  AIR = 'AIR',
  ROAD = 'ROAD',
}

export enum LocationType {
  SEAPORT = 'SEAPORT',
  AIRPORT = 'AIRPORT',
  DEPOT = 'DEPOT',
}

export enum ShipmentStatus {
  CREATED = 'CREATED',
  BOOKED = 'BOOKED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
}

export enum ExceptionType {
  CUSTOMS_HOLD = 'CUSTOMS_HOLD',
  WEATHER_DELAY = 'WEATHER_DELAY',
  PORT_CONGESTION = 'PORT_CONGESTION',
  DAMAGED = 'DAMAGED',
  MISROUTED = 'MISROUTED',
  DOCUMENTATION_ISSUE = 'DOCUMENTATION_ISSUE',
}

export enum ExceptionStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
}

export enum SeverityLevel {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export type ModeEventType =
  // SEA events
  | 'BOOKING_CONFIRMED'
  | 'LOADED_ON_VESSEL'
  | 'DEPARTED_PORT'
  | 'ARRIVED_PORT'
  | 'DISCHARGED'
  // AIR events
  | 'ACCEPTED_AT_ORIGIN'
  | 'DEPARTED_AIRPORT'
  | 'ARRIVED_AIRPORT'
  | 'CLEARED_FOR_PICKUP'
  // ROAD events
  | 'PICKED_UP_FROM_SHIPPER'
  | 'DEPARTED_DEPOT'
  | 'ARRIVED_DEPOT'
  | 'OUT_FOR_DELIVERY'
  // Common events
  | 'STATUS_CHANGE'
  | 'LOCATION_UPDATE'
  | 'EXCEPTION_REPORTED'
  | 'EXCEPTION_RESOLVED';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  company_name: string;
  avatar_initials: string;
}

export interface Carrier {
  id: number;
  code: string;
  name: string;
  mode: TransportMode;
  contact_email: string;
  fleet_summary: string;
  active: boolean;
}

export interface Location {
  id: number;
  code: string; // UN/LOCODE, IATA, or Depot code
  name: string;
  city: string;
  country: string;
  type: LocationType;
  latitude: number;
  longitude: number;
}

export interface ShipmentItem {
  id: number;
  shipment_id: number;
  sku: string;
  description: string;
  quantity: number;
  unit_type: 'TEU' | 'PALLET' | 'CARTON' | 'CRATE';
  weight_kg: number;
  volume_cbm: number;
  hs_code: string;
}

export interface TrackingEvent {
  id: number;
  shipment_id: number;
  event_type: ModeEventType;
  status_after: ShipmentStatus | null;
  event_timestamp: string; // ISO 8601
  location_id: number | null;
  location_name: string;
  latitude: number;
  longitude: number;
  description: string;
  is_exception: boolean;
  created_by_user_id: number;
  created_by_name: string;
}

export interface ShipmentException {
  id: number;
  shipment_id: number;
  shipment_number: string;
  exception_type: ExceptionType;
  severity: SeverityLevel;
  status: ExceptionStatus;
  title: string;
  description: string;
  resolution_notes: string | null;
  detected_at: string; // ISO 8601
  resolved_at: string | null; // ISO 8601
  reported_by_user_id: number;
  reported_by_name: string;
}

export interface Shipment {
  id: number;
  shipment_number: string; // Unique e.g. CT-2026-000101
  route_code: string; // e.g. RT-0142
  customer_id: number;
  customer_name: string;
  carrier_id: number;
  mode: TransportMode;
  vehicle_ref: string; // Vessel + voyage, Flight number, or Truck plate + class
  origin_location_id: number;
  destination_location_id: number;
  cargo_type: string;
  total_weight_kg: number;
  total_volume_cbm: number;
  expected_departure: string; // ISO 8601
  expected_arrival: string; // ISO 8601
  estimated_arrival: string; // ISO 8601 (Updated deterministically from events/delays)
  actual_arrival: string | null;
  status: ShipmentStatus;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number | null; // null = broadcast to operators/admins, or customer_id
  shipment_id: number;
  shipment_number: string;
  type: 'STATUS_CHANGED' | 'DELAY_DETECTED' | 'EXCEPTION_OPENED' | 'EXCEPTION_RESOLVED';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_user_id: number;
  actor_name: string;
  actor_role: UserRole;
  action: string; // e.g., SHIPMENT_CREATED, STATUS_TRANSITION, EXCEPTION_RESOLVED, THRESHOLD_UPDATED
  entity_type: 'Shipment' | 'TrackingEvent' | 'ShipmentException' | 'Carrier' | 'Location' | 'Settings';
  entity_id: string;
  summary: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export interface GroupConfigSettings {
  group_name: string;
  primary_route_focus: string;
  delay_threshold_hours: number; // Default 12h for Group A (configurable live during interview!)
  low_severity_max_hours: number; // 6h
  medium_severity_max_hours: number; // 24h
  main_exception_focus: ExceptionType;
  group_kpi_label: string;
  multimodal_option: 'Option A (Primary Mode per Shipment)';
}

export interface EtaEvaluationResult {
  is_delayed: boolean;
  exceeds_group_threshold: boolean;
  delay_hours: number;
  delay_minutes: number;
  severity: SeverityLevel;
  expected_arrival: string;
  estimated_arrival: string;
  group_threshold_hours: number;
  reason: string;
}

export interface RouteVolumeRow {
  route_code: string;
  origin: Location;
  destination: Location;
  carrier: Carrier;
  vehicle_ref: string;
  mode: TransportMode;
  mode_label: string;
  representative_status: ShipmentStatus;
  is_delayed: boolean;
  distance_km: number;
  distance_mi: number;
  shipment_count: number;
  avg_transit_days: number;
  on_time_rate: number;
  sample_shipment_id: number;
  sample_shipment_number: string;
}

export interface WeatherSnapshot {
  location_code: string;
  location_name: string;
  temperature_c: number;
  wind_speed_kmh: number;
  condition_label: string;
  humidity_pct: number;
  visibility_km: number;
  fetched_at: string;
  source: 'Open-Meteo Live API' | 'Cached Fallback (Service Offline)';
}
