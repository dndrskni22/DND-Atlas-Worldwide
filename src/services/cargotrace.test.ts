import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthPolicyService,
  DEFAULT_MAP_INTERACTIVITY_OPTIONS,
  EtaService,
  ShipmentService,
  TrackingService,
  calculateHaversineKm,
  computeCompassIndicatorState,
  getCardinalDirection,
  normalizeCompassBearing,
} from './CargoTraceService';
import {
  Carrier,
  ExceptionType,
  GroupConfigSettings,
  Location,
  LocationType,
  SeverityLevel,
  Shipment,
  ShipmentStatus,
  TrackingEvent,
  TransportMode,
  User,
  UserRole,
} from '../types/cargotrace';

const defaultSettings: GroupConfigSettings = {
  group_name: 'A',
  primary_route_focus: 'Southeast Asia → Europe',
  delay_threshold_hours: 12,
  low_severity_max_hours: 6,
  medium_severity_max_hours: 24,
  main_exception_focus: ExceptionType.CUSTOMS_HOLD,
  group_kpi_label: 'On-Time Delivery Rate',
  multimodal_option: 'Option A (Primary Mode per Shipment)',
};

const seaportOrigin: Location = {
  id: 1,
  code: 'IDTPP',
  name: 'Port of Tanjung Priok',
  city: 'Jakarta',
  country: 'Indonesia',
  type: LocationType.SEAPORT,
  latitude: -6.1045,
  longitude: 106.8805,
};

const seaportDest: Location = {
  id: 2,
  code: 'NLRTM',
  name: 'Port of Rotterdam',
  city: 'Rotterdam',
  country: 'Netherlands',
  type: LocationType.SEAPORT,
  latitude: 51.949,
  longitude: 4.145,
};

const airportOrigin: Location = {
  id: 3,
  code: 'CGK',
  name: 'Soekarno-Hatta International Airport',
  city: 'Tangerang',
  country: 'Indonesia',
  type: LocationType.AIRPORT,
  latitude: -6.1256,
  longitude: 106.6558,
};

const airportDest: Location = {
  id: 4,
  code: 'AMS',
  name: 'Amsterdam Airport Schiphol',
  city: 'Amsterdam',
  country: 'Netherlands',
  type: LocationType.AIRPORT,
  latitude: 52.3105,
  longitude: 4.7683,
};

const roadDepot: Location = {
  id: 5,
  code: 'IDCKG',
  name: 'Cikarang Dry Port & Logistics Hub',
  city: 'Bekasi',
  country: 'Indonesia',
  type: LocationType.DEPOT,
  latitude: -6.2845,
  longitude: 107.1485,
};

const seaCarrier: Carrier = {
  id: 10,
  code: 'NML',
  name: 'Nusantara Maritime Lines',
  mode: TransportMode.SEA,
  contact_email: 'ops@nusantaramaritime.example',
  fleet_summary: '14 Ultra-Large Container Vessels',
  active: true,
};

const airCarrier: Carrier = {
  id: 11,
  code: 'GSA',
  name: 'Garuda SkyCargo Express',
  mode: TransportMode.AIR,
  contact_email: 'cargo@skycargo.example',
  fleet_summary: '8 Widebody Freighters',
  active: true,
};

const roadCarrier: Carrier = {
  id: 12,
  code: 'TJF',
  name: 'TransJava Overland Haulage',
  mode: TransportMode.ROAD,
  contact_email: 'dispatch@transjava.example',
  fleet_summary: '60 Heavy Articulated Trucks',
  active: true,
};

test('EtaService: evaluates on-time, LOW (<=6h), MEDIUM (>6-24h), HIGH (>24h), and dynamic lecturer threshold changes', () => {
  // 1. On-time shipment
  const onTime = EtaService.evaluate(
    '2026-11-10T10:00:00Z',
    '2026-11-10T09:30:00Z',
    defaultSettings
  );
  assert.equal(onTime.is_delayed, false);
  assert.equal(onTime.severity, SeverityLevel.NONE);
  assert.equal(onTime.exceeds_group_threshold, false);

  // 2. Boundary 6h -> LOW severity, below 12h Group A threshold
  const low6h = EtaService.evaluate(
    '2026-11-10T10:00:00Z',
    '2026-11-10T16:00:00Z',
    defaultSettings
  );
  assert.equal(low6h.is_delayed, true);
  assert.equal(low6h.delay_hours, 6);
  assert.equal(low6h.severity, SeverityLevel.LOW);
  assert.equal(low6h.exceeds_group_threshold, false);

  // 3. Boundary 12h -> MEDIUM severity, meets Group A 12h threshold
  const med12h = EtaService.evaluate(
    '2026-11-10T10:00:00Z',
    '2026-11-10T22:00:00Z',
    defaultSettings
  );
  assert.equal(med12h.is_delayed, true);
  assert.equal(med12h.delay_hours, 12);
  assert.equal(med12h.severity, SeverityLevel.MEDIUM);
  assert.equal(med12h.exceeds_group_threshold, true);

  // 4. Live Lecturer Interview Change: change delay_threshold_hours from 12 to 18
  const updatedSettings = { ...defaultSettings, delay_threshold_hours: 18 };
  const med12hAfterChange = EtaService.evaluate(
    '2026-11-10T10:00:00Z',
    '2026-11-10T22:00:00Z',
    updatedSettings
  );
  assert.equal(med12hAfterChange.exceeds_group_threshold, false);

  // 5. Boundary >24h -> HIGH severity
  const high30h = EtaService.evaluate(
    '2026-11-10T10:00:00Z',
    '2026-11-11T16:00:00Z',
    defaultSettings
  );
  assert.equal(high30h.delay_hours, 30);
  assert.equal(high30h.severity, SeverityLevel.HIGH);
  assert.equal(high30h.exceeds_group_threshold, true);
});

test('ShipmentService: enforces valid status transitions and blocks invalid or post-DELIVERED transitions', () => {
  // Valid step-by-step lifecycle
  assert.equal(
    ShipmentService.validateStatusTransition(ShipmentStatus.CREATED, ShipmentStatus.BOOKED).valid,
    true
  );
  assert.equal(
    ShipmentService.validateStatusTransition(ShipmentStatus.BOOKED, ShipmentStatus.PICKED_UP).valid,
    true
  );
  assert.equal(
    ShipmentService.validateStatusTransition(ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT).valid,
    true
  );
  assert.equal(
    ShipmentService.validateStatusTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED).valid,
    true
  );

  // Invalid jump: CREATED -> IN_TRANSIT
  const invalidJump = ShipmentService.validateStatusTransition(
    ShipmentStatus.CREATED,
    ShipmentStatus.IN_TRANSIT
  );
  assert.equal(invalidJump.valid, false);
  assert.equal(invalidJump.status_code, 422);

  // Invalid terminal rollback: DELIVERED -> IN_TRANSIT
  const terminalRollback = ShipmentService.validateStatusTransition(
    ShipmentStatus.DELIVERED,
    ShipmentStatus.IN_TRANSIT
  );
  assert.equal(terminalRollback.valid, false);
  assert.equal(terminalRollback.status_code, 422);
});

test('ShipmentService: enforces SEA, AIR, ROAD multimodal compatibility rules', () => {
  // Valid SEA shipment (SEAPORT -> SEAPORT with SEA carrier)
  const validSea = ShipmentService.validateShipmentPayload({
    mode: TransportMode.SEA,
    carrier: seaCarrier,
    origin: seaportOrigin,
    destination: seaportDest,
    cargo_type: 'Industrial Machinery & Electronics',
    total_weight_kg: 18500,
    total_volume_cbm: 64,
    expected_departure: '2026-11-01T08:00:00Z',
    expected_arrival: '2026-11-22T18:00:00Z',
  });
  assert.equal(validSea.valid, true);

  // Invalid SEA shipment using AIRPORT destination
  const invalidSeaAirport = ShipmentService.validateShipmentPayload({
    mode: TransportMode.SEA,
    carrier: seaCarrier,
    origin: seaportOrigin,
    destination: airportDest,
    cargo_type: 'Industrial Machinery',
    total_weight_kg: 18500,
    total_volume_cbm: 64,
    expected_departure: '2026-11-01T08:00:00Z',
    expected_arrival: '2026-11-22T18:00:00Z',
  });
  assert.equal(invalidSeaAirport.valid, false);
  assert.equal(invalidSeaAirport.status_code, 422);

  // Invalid AIR shipment using SEAPORT origin
  const invalidAirSeaport = ShipmentService.validateShipmentPayload({
    mode: TransportMode.AIR,
    carrier: airCarrier,
    origin: seaportOrigin,
    destination: airportDest,
    cargo_type: 'Vaccines & Cold-Chain Pharma',
    total_weight_kg: 1200,
    total_volume_cbm: 8.5,
    expected_departure: '2026-11-05T02:00:00Z',
    expected_arrival: '2026-11-06T06:00:00Z',
  });
  assert.equal(invalidAirSeaport.valid, false);
  assert.equal(invalidAirSeaport.status_code, 422);

  // Invalid Carrier Mode Mismatch (SEA shipment assigned to ROAD carrier)
  const carrierMismatch = ShipmentService.validateShipmentPayload({
    mode: TransportMode.SEA,
    carrier: roadCarrier,
    origin: seaportOrigin,
    destination: seaportDest,
    cargo_type: 'Textiles',
    total_weight_kg: 9000,
    total_volume_cbm: 33,
    expected_departure: '2026-11-01T08:00:00Z',
    expected_arrival: '2026-11-22T18:00:00Z',
  });
  assert.equal(carrierMismatch.valid, false);
  assert.equal(carrierMismatch.status_code, 422);

  // Valid ROAD shipment between DEPOT and SEAPORT (intermodal drayage allowed for ROAD)
  const validRoad = ShipmentService.validateShipmentPayload({
    mode: TransportMode.ROAD,
    carrier: roadCarrier,
    origin: roadDepot,
    destination: seaportOrigin,
    cargo_type: 'Automotive Components',
    total_weight_kg: 6400,
    total_volume_cbm: 24,
    expected_departure: '2026-11-05T06:00:00Z',
    expected_arrival: '2026-11-05T14:00:00Z',
  });
  assert.equal(validRoad.valid, true);
});

test('AuthPolicyService: enforces server-side RBAC and isolates customers from other customers shipments', () => {
  const customerA: User = {
    id: 101,
    name: 'Ayu Lestari',
    email: 'ayu@nusantararetail.co.id',
    role: UserRole.CUSTOMER,
    company_name: 'PT Nusantara Retail',
    avatar_initials: 'AL',
  };
  const customerB: User = {
    id: 102,
    name: 'Hendrik Van Der Berg',
    email: 'h.vanderberg@eurotech-bv.nl',
    role: UserRole.CUSTOMER,
    company_name: 'EuroTech Logistics B.V.',
    avatar_initials: 'HV',
  };
  const operator: User = {
    id: 201,
    name: 'Budiono Siregar',
    email: 'budisiregar@cargotrace.id',
    role: UserRole.OPERATOR,
    company_name: 'CargoTrace Operations',
    avatar_initials: 'BS',
  };

  const shipmentOwnedByA: Shipment = {
    id: 500,
    shipment_number: 'CT-2026-000101',
    route_code: 'RT-0142',
    customer_id: 101,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 10,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Ocean Pertiwi · V.408W',
    origin_location_id: 1,
    destination_location_id: 2,
    cargo_type: 'Consumer Electronics',
    total_weight_kg: 14000,
    total_volume_cbm: 52,
    expected_departure: '2026-11-01T08:00:00Z',
    expected_arrival: '2026-11-20T18:00:00Z',
    estimated_arrival: '2026-11-20T18:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-03T00:00:00Z',
  };

  // Unauthenticated -> 401
  assert.equal(AuthPolicyService.canViewShipment(null, shipmentOwnedByA).status_code, 401);
  // Owner Customer A -> 200
  assert.equal(AuthPolicyService.canViewShipment(customerA, shipmentOwnedByA).status_code, 200);
  // Other Customer B -> 403 Forbidden
  assert.equal(AuthPolicyService.canViewShipment(customerB, shipmentOwnedByA).status_code, 403);
  // Operator -> 200
  assert.equal(AuthPolicyService.canViewShipment(operator, shipmentOwnedByA).status_code, 200);
  // Customer cannot mutate shipment -> 403
  assert.equal(AuthPolicyService.canMutateShipment(customerA).status_code, 403);
  // Operator cannot mutate Admin settings -> 403
  assert.equal(AuthPolicyService.canManageMasterDataOrSettings(operator).status_code, 403);
});

test('TrackingService: validates mode vocabulary and chronological order', () => {
  const seaShipment: Shipment = {
    id: 500,
    shipment_number: 'CT-2026-000101',
    route_code: 'RT-0142',
    customer_id: 101,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 10,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Ocean Pertiwi · V.408W',
    origin_location_id: 1,
    destination_location_id: 2,
    cargo_type: 'Consumer Electronics',
    total_weight_kg: 14000,
    total_volume_cbm: 52,
    expected_departure: '2026-11-01T08:00:00Z',
    expected_arrival: '2026-11-20T18:00:00Z',
    estimated_arrival: '2026-11-20T18:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.BOOKED,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T09:00:00Z',
  };

  const existingEvents: TrackingEvent[] = [
    {
      id: 1,
      shipment_id: 500,
      event_type: 'BOOKING_CONFIRMED',
      status_after: ShipmentStatus.BOOKED,
      event_timestamp: '2026-11-01T09:00:00Z',
      location_id: 1,
      location_name: 'Port of Tanjung Priok',
      latitude: -6.1045,
      longitude: 106.8805,
      description: 'Booking confirmed with Nusantara Maritime Lines.',
      is_exception: false,
      created_by_user_id: 201,
      created_by_name: 'Budiono Siregar',
    },
  ];

  // Reject AIR event on SEA shipment
  const wrongVocabulary = TrackingService.validateNewEvent({
    shipment: seaShipment,
    existingEvents,
    event_type: 'DEPARTED_AIRPORT',
    status_after: null,
    event_timestamp: '2026-11-02T10:00:00Z',
    description: 'Attempted airport event on sea vessel',
  });
  assert.equal(wrongVocabulary.valid, false);
  assert.equal(wrongVocabulary.status_code, 422);

  // Reject out-of-order past timestamp
  const outOfOrder = TrackingService.validateNewEvent({
    shipment: seaShipment,
    existingEvents,
    event_type: 'LOADED_ON_VESSEL',
    status_after: ShipmentStatus.PICKED_UP,
    event_timestamp: '2026-11-01T07:00:00Z', // Before 09:00:00Z
    description: 'Container loaded onto vessel',
  });
  assert.equal(outOfOrder.valid, false);
  assert.equal(outOfOrder.status_code, 422);

  // Accept valid chronological SEA event with valid BOOKED -> PICKED_UP transition
  const validEvent = TrackingService.validateNewEvent({
    shipment: seaShipment,
    existingEvents,
    event_type: 'LOADED_ON_VESSEL',
    status_after: ShipmentStatus.PICKED_UP,
    event_timestamp: '2026-11-02T11:30:00Z',
    description: 'Container loaded aboard MV Ocean Pertiwi at Berth 3.',
  });
  assert.equal(validEvent.valid, true);
  assert.equal(validEvent.status_code, 201);

  // Verify Haversine distance Jakarta -> Rotterdam is ~11,350 km
  const distKm = calculateHaversineKm(
    seaportOrigin.latitude,
    seaportOrigin.longitude,
    seaportDest.latitude,
    seaportDest.longitude
  );
  assert.equal(distKm > 11000 && distKm < 11600, true);
});

test('REST API (Brief Slide 12 & 13): enforces 200/201/401/403/404/422 contracts, customer isolation, and status rules over HTTP', async () => {
  const express = (await import('express')).default;
  const { createCargoTraceApiRouter } = await import('../api/cargoTraceRouter');
  const app = express();
  app.use('/api', createCargoTraceApiRouter());

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/shipments`);
    assert.equal(unauthRes.status, 401);

    // 2. Login with valid Operator credentials -> 200 + token
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'budisiregar@cargotrace.id', password: 'password123' }),
    });
    assert.equal(loginRes.status, 200);
    const loginJson = (await loginRes.json()) as { token: string; user: User };
    assert.ok(loginJson.token);
    assert.equal(loginJson.user.role, UserRole.OPERATOR);

    // 3. Customer isolation: Customer 4 (ayu@nusantararetail.co.id) can only see their own shipments
    const custListRes = await fetch(`${baseUrl}/shipments`, {
      headers: { Authorization: 'Bearer demo-token-customer-4' },
    });
    assert.equal(custListRes.status, 200);
    const custListJson = (await custListRes.json()) as { data: Shipment[] };
    assert.ok(custListJson.data.length > 0);
    assert.ok(custListJson.data.every((s) => s.customer_id === 4));

    // 4. Customer 5 attempting to view Customer 4's shipment -> 403 Forbidden
    const cust4ShipmentId = custListJson.data[0].id;
    const forbiddenViewRes = await fetch(`${baseUrl}/shipments/${cust4ShipmentId}`, {
      headers: { Authorization: 'Bearer demo-token-customer-5' },
    });
    assert.equal(forbiddenViewRes.status, 403);

    // 5. Customer attempting POST /api/shipments -> 403 Forbidden
    const forbiddenCreateRes = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer demo-token-customer-4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(forbiddenCreateRes.status, 403);

    // 6. Operator attempting invalid SEA shipment with AIRPORT destination -> 422 Validation Error
    const invalidCreateRes = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${loginJson.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: 4,
        carrier_id: 1, // SEA carrier
        mode: 'SEA',
        origin_location_id: 1, // SEAPORT
        destination_location_id: 7, // AIRPORT -> invalid for SEA
        cargo_type: 'Test Invalid Multimodal',
        total_weight_kg: 5000,
        total_volume_cbm: 20,
      }),
    });
    assert.equal(invalidCreateRes.status, 422);
  } finally {
    server.close();
  }
});

test('Map Compass & Interactivity: computes compass orientation from view angle and enables scrollWheelZoom, dragging, and zoomControl', () => {
  // 1. Verify default North orientation (0 deg)
  assert.equal(normalizeCompassBearing(0), 0);
  assert.equal(normalizeCompassBearing(360), 0);
  assert.equal(normalizeCompassBearing(-45), 315);
  assert.equal(getCardinalDirection(0), 'N');
  assert.equal(getCardinalDirection(45), 'NE');
  assert.equal(getCardinalDirection(90), 'E');
  assert.equal(getCardinalDirection(180), 'S');
  assert.equal(getCardinalDirection(-45), 'NW');

  const northState = computeCompassIndicatorState(0, 0);
  assert.equal(northState.normalizedBearing, 0);
  assert.equal(northState.needleRotationDeg, 0);
  assert.equal(northState.cardinal, 'N');
  assert.equal(northState.formattedLabel, '0° N');
  assert.equal(northState.isRotated, false);

  // 2. Verify rotated view angle (45 deg East -> needle points -45 deg to keep True North accurate)
  const rotatedState = computeCompassIndicatorState(45, 18);
  assert.equal(rotatedState.normalizedBearing, 45);
  assert.equal(rotatedState.needleRotationDeg, -45);
  assert.equal(rotatedState.cardinal, 'NE');
  assert.equal(rotatedState.formattedLabel, '45° NE');
  assert.equal(rotatedState.isRotated, true);

  // 3. Verify map interactivity options (scrollWheelZoom, dragging, zoomControl)
  assert.equal(DEFAULT_MAP_INTERACTIVITY_OPTIONS.scrollWheelZoom, true);
  assert.equal(DEFAULT_MAP_INTERACTIVITY_OPTIONS.dragging, true);
  assert.equal(DEFAULT_MAP_INTERACTIVITY_OPTIONS.zoomControl, true);
  assert.equal(DEFAULT_MAP_INTERACTIVITY_OPTIONS.scrollZoom, true);
  assert.equal(DEFAULT_MAP_INTERACTIVITY_OPTIONS.dragPan, true);
  assert.equal(DEFAULT_MAP_INTERACTIVITY_OPTIONS.dragRotate, true);
});


