// CargoTrace Realistic Multimodal Seed Dataset (Synthetic, Consistent, Documented)
// Reference: CargoTrace_UAS_Final_Project_Brief_2.pdf (Slides 4, 6, 7, 8, 11, 23)

import {
  AuditLogEntry,
  Carrier,
  ExceptionStatus,
  ExceptionType,
  GroupConfigSettings,
  Location,
  LocationType,
  NotificationItem,
  SeverityLevel,
  Shipment,
  ShipmentException,
  ShipmentItem,
  ShipmentStatus,
  TrackingEvent,
  TransportMode,
  User,
  UserRole,
} from '../types/cargotrace';

export const INITIAL_GROUP_SETTINGS: GroupConfigSettings = {
  group_name: 'Group A',
  primary_route_focus: 'Southeast Asia → Europe',
  delay_threshold_hours: 12,
  low_severity_max_hours: 6,
  medium_severity_max_hours: 24,
  main_exception_focus: ExceptionType.CUSTOMS_HOLD,
  group_kpi_label: 'On-Time Delivery Rate',
  multimodal_option: 'Option A (Primary Mode per Shipment)',
};

export const SEED_USERS: User[] = [
  {
    id: 1,
    name: 'Rendra Wijaya',
    email: 'admin@cargotrace.id',
    role: UserRole.ADMIN,
    company_name: 'CargoTrace HQ Admin',
    avatar_initials: 'RW',
  },
  {
    id: 2,
    name: 'Budiono Siregar',
    email: 'budisiregar@cargotrace.id',
    role: UserRole.OPERATOR,
    company_name: 'CargoTrace Operations Desk',
    avatar_initials: 'BS',
  },
  {
    id: 3,
    name: 'Siti Rahmawati',
    email: 'siti.ops@cargotrace.id',
    role: UserRole.OPERATOR,
    company_name: 'CargoTrace Operations Desk',
    avatar_initials: 'SR',
  },
  {
    id: 4,
    name: 'Ayu Lestari',
    email: 'ayu@nusantararetail.co.id',
    role: UserRole.CUSTOMER,
    company_name: 'PT Nusantara Retail',
    avatar_initials: 'AL',
  },
  {
    id: 5,
    name: 'Hendrik Van Der Berg',
    email: 'h.vanderberg@eurotech-bv.nl',
    role: UserRole.CUSTOMER,
    company_name: 'EuroTech Industrial B.V.',
    avatar_initials: 'HV',
  },
  {
    id: 6,
    name: 'Bambang Hartono',
    email: 'bambang@indoagro-export.co.id',
    role: UserRole.CUSTOMER,
    company_name: 'PT IndoAgro Commodities',
    avatar_initials: 'BH',
  },
];

export const SEED_LOCATIONS: Location[] = [
  // SEAPORTS (6)
  {
    id: 1,
    code: 'IDTPP',
    name: 'Port of Tanjung Priok',
    city: 'Jakarta',
    country: 'Indonesia',
    type: LocationType.SEAPORT,
    latitude: -6.1045,
    longitude: 106.8805,
  },
  {
    id: 2,
    code: 'IDSUB',
    name: 'Port of Tanjung Perak',
    city: 'Surabaya',
    country: 'Indonesia',
    type: LocationType.SEAPORT,
    latitude: -7.1995,
    longitude: 112.733,
  },
  {
    id: 3,
    code: 'SGSIN',
    name: 'Port of Singapore (Tuas Terminal)',
    city: 'Singapore',
    country: 'Singapore',
    type: LocationType.SEAPORT,
    latitude: 1.2644,
    longitude: 103.8405,
  },
  {
    id: 4,
    code: 'MYPKG',
    name: 'Port Klang Northport',
    city: 'Klang',
    country: 'Malaysia',
    type: LocationType.SEAPORT,
    latitude: 3.0005,
    longitude: 101.391,
  },
  {
    id: 5,
    code: 'NLRTM',
    name: 'Port of Rotterdam (Maasvlakte)',
    city: 'Rotterdam',
    country: 'Netherlands',
    type: LocationType.SEAPORT,
    latitude: 51.949,
    longitude: 4.145,
  },
  {
    id: 6,
    code: 'DEHAM',
    name: 'Port of Hamburg (Altenwerder)',
    city: 'Hamburg',
    country: 'Germany',
    type: LocationType.SEAPORT,
    latitude: 53.5413,
    longitude: 9.984,
  },
  // AIRPORTS (4)
  {
    id: 7,
    code: 'CGK',
    name: 'Soekarno-Hatta Cargo Terminal',
    city: 'Jakarta',
    country: 'Indonesia',
    type: LocationType.AIRPORT,
    latitude: -6.1256,
    longitude: 106.6558,
  },
  {
    id: 8,
    code: 'SIN',
    name: 'Changi Airfreight Centre',
    city: 'Singapore',
    country: 'Singapore',
    type: LocationType.AIRPORT,
    latitude: 1.3644,
    longitude: 103.9915,
  },
  {
    id: 9,
    code: 'AMS',
    name: 'Amsterdam Schiphol Cargo Hub',
    city: 'Amsterdam',
    country: 'Netherlands',
    type: LocationType.AIRPORT,
    latitude: 52.3105,
    longitude: 4.7683,
  },
  {
    id: 10,
    code: 'SYD',
    name: 'Sydney Kingsford Smith Freight Hub',
    city: 'Sydney',
    country: 'Australia',
    type: LocationType.AIRPORT,
    latitude: -33.9399,
    longitude: 151.1753,
  },
  // ROAD DEPOTS (4)
  {
    id: 11,
    code: 'IDCKG',
    name: 'Cikarang Dry Port & Logistics Park',
    city: 'Cikarang',
    country: 'Indonesia',
    type: LocationType.DEPOT,
    latitude: -6.2845,
    longitude: 107.1485,
  },
  {
    id: 12,
    code: 'IDBDG',
    name: 'Bandung Gedebage Inland Depot',
    city: 'Bandung',
    country: 'Indonesia',
    type: LocationType.DEPOT,
    latitude: -6.953,
    longitude: 107.697,
  },
  {
    id: 13,
    code: 'IDSLO',
    name: 'Surakarta Central Java Distribution Hub',
    city: 'Surakarta',
    country: 'Indonesia',
    type: LocationType.DEPOT,
    latitude: -7.5561,
    longitude: 110.8317,
  },
  {
    id: 14,
    code: 'NLEIN',
    name: 'Eindhoven Benelux Logistics Depot',
    city: 'Eindhoven',
    country: 'Netherlands',
    type: LocationType.DEPOT,
    latitude: 51.4416,
    longitude: 5.4697,
  },
];

export const SEED_CARRIERS: Carrier[] = [
  {
    id: 1,
    code: 'NML',
    name: 'Nusantara Maritime Lines',
    mode: TransportMode.SEA,
    contact_email: 'ops@nusantaramaritime.example',
    fleet_summary: '16 Container Vessels · 14,000 TEU Class',
    active: true,
  },
  {
    id: 2,
    code: 'EOS',
    name: 'EuroAsia Ocean Star',
    mode: TransportMode.SEA,
    contact_email: 'booking@euroasiaocean.example',
    fleet_summary: '22 Deep-Sea Boxships · Ultra Large Class',
    active: true,
  },
  {
    id: 3,
    code: 'SAC',
    name: 'Stratos Air Cargo',
    mode: TransportMode.AIR,
    contact_email: 'dispatch@stratosair.example',
    fleet_summary: '11 Widebody B777F & A330-200F Freighters',
    active: true,
  },
  {
    id: 4,
    code: 'AAF',
    name: 'Archipelago AeroFreight',
    mode: TransportMode.AIR,
    contact_email: 'loadmaster@aerofreight.example',
    fleet_summary: '9 Regional & Intercontinental Cargo Jets',
    active: true,
  },
  {
    id: 5,
    code: 'SHE',
    name: 'Swift Haul Express',
    mode: TransportMode.ROAD,
    contact_email: 'fleet@swifthaul.example',
    fleet_summary: '45 Heavy Articulated HGV Class 1 Trucks',
    active: true,
  },
  {
    id: 6,
    code: 'ARF',
    name: 'Auto Route Freight',
    mode: TransportMode.ROAD,
    contact_email: 'ops@autoroutefreight.example',
    fleet_summary: '38 Box Van & Refrigerated Road Units',
    active: true,
  },
  {
    id: 7,
    code: 'TEC',
    name: 'Trans Euro Carriers',
    mode: TransportMode.ROAD,
    contact_email: 'routing@transeuro.example',
    fleet_summary: '52 Continental Heavy Haulage Rigs',
    active: true,
  },
];

// Generate 45 realistic multimodal shipments anchored around 2026-11-05
export const SEED_SHIPMENTS: Shipment[] = [
  // --- SEA FREIGHT SHIPMENTS (18) ---
  {
    id: 101,
    shipment_number: 'DND-2026-000101',
    route_code: 'RT-0142',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 1,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Ocean Pertiwi · Voy 408W',
    origin_location_id: 1, // IDTPP Jakarta
    destination_location_id: 5, // NLRTM Rotterdam
    cargo_type: 'Consumer Electronics & Smart Appliances',
    total_weight_kg: 42500,
    total_volume_cbm: 132,
    expected_departure: '2026-10-18T08:00:00Z',
    expected_arrival: '2026-11-05T06:00:00Z',
    estimated_arrival: '2026-11-05T22:00:00Z', // +16h delay (MEDIUM, >12h threshold)
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-10-15T09:00:00Z',
    updated_at: '2026-11-05T02:15:00Z',
  },
  {
    id: 102,
    shipment_number: 'DND-2026-000102',
    route_code: 'RT-0142',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 2,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Northern Meridian · Voy 119E',
    origin_location_id: 3, // SGSIN Singapore
    destination_location_id: 5, // NLRTM Rotterdam
    cargo_type: 'Precision CNC Milling Sub-Assemblies',
    total_weight_kg: 68200,
    total_volume_cbm: 196,
    expected_departure: '2026-10-20T10:00:00Z',
    expected_arrival: '2026-11-08T14:00:00Z',
    estimated_arrival: '2026-11-08T14:00:00Z', // On schedule
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-10-17T11:30:00Z',
    updated_at: '2026-11-04T19:00:00Z',
  },
  {
    id: 103,
    shipment_number: 'DND-2026-000103',
    route_code: 'RT-0188',
    customer_id: 6,
    customer_name: 'PT IndoAgro Commodities',
    carrier_id: 1,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Krakatau Star · Voy 204N',
    origin_location_id: 2, // IDSUB Surabaya
    destination_location_id: 6, // DEHAM Hamburg
    cargo_type: 'Specialty Arabica Green Coffee Beans (6x20ft TEU)',
    total_weight_kg: 108000,
    total_volume_cbm: 198,
    expected_departure: '2026-10-12T06:00:00Z',
    expected_arrival: '2026-11-03T12:00:00Z',
    estimated_arrival: '2026-11-05T08:00:00Z', // +44h delay (HIGH, CUSTOMS_HOLD)
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-10-10T08:00:00Z',
    updated_at: '2026-11-05T01:40:00Z',
  },
  {
    id: 104,
    shipment_number: 'DND-2026-000104',
    route_code: 'RT-0109',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 1,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Sunda Strait · Voy 812S',
    origin_location_id: 4, // MYPKG Port Klang
    destination_location_id: 1, // IDTPP Tanjung Priok
    cargo_type: 'Packaged Food & Retail Gondola Shelving',
    total_weight_kg: 31400,
    total_volume_cbm: 88,
    expected_departure: '2026-10-28T07:00:00Z',
    expected_arrival: '2026-11-01T15:00:00Z',
    estimated_arrival: '2026-11-01T14:20:00Z',
    actual_arrival: '2026-11-01T14:20:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-10-25T10:00:00Z',
    updated_at: '2026-11-01T15:00:00Z',
  },
  {
    id: 105,
    shipment_number: 'DND-2026-000105',
    route_code: 'RT-0142',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 2,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Baltic Vanguard · Voy 305W',
    origin_location_id: 1, // IDTPP Jakarta
    destination_location_id: 5, // NLRTM Rotterdam
    cargo_type: 'Solar Inverter Cabinets & Lithium Battery Racks',
    total_weight_kg: 54000,
    total_volume_cbm: 145,
    expected_departure: '2026-10-05T09:00:00Z',
    expected_arrival: '2026-10-29T18:00:00Z',
    estimated_arrival: '2026-10-29T16:45:00Z',
    actual_arrival: '2026-10-29T16:45:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-10-02T14:00:00Z',
    updated_at: '2026-10-29T17:15:00Z',
  },
  {
    id: 106,
    shipment_number: 'DND-2026-000106',
    route_code: 'RT-0155',
    customer_id: 6,
    customer_name: 'PT IndoAgro Commodities',
    carrier_id: 2,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Friesland Express · Voy 611W',
    origin_location_id: 2, // IDSUB Surabaya
    destination_location_id: 5, // NLRTM Rotterdam
    cargo_type: 'Rattan Furniture & Certified Teak Decking',
    total_weight_kg: 38900,
    total_volume_cbm: 160,
    expected_departure: '2026-11-06T12:00:00Z',
    expected_arrival: '2026-11-28T09:00:00Z',
    estimated_arrival: '2026-11-28T09:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.BOOKED,
    created_at: '2026-11-03T10:20:00Z',
    updated_at: '2026-11-04T09:00:00Z',
  },
  {
    id: 107,
    shipment_number: 'DND-2026-000107',
    route_code: 'RT-0160',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 1,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Java Pioneer · Voy 509N',
    origin_location_id: 1, // IDTPP
    destination_location_id: 3, // SGSIN
    cargo_type: 'Garment & Footwear Seasonal Stock',
    total_weight_kg: 22000,
    total_volume_cbm: 92,
    expected_departure: '2026-11-04T18:00:00Z',
    expected_arrival: '2026-11-06T12:00:00Z',
    estimated_arrival: '2026-11-06T17:00:00Z', // +5h delay (LOW severity)
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-02T08:00:00Z',
    updated_at: '2026-11-05T00:30:00Z',
  },
  {
    id: 108,
    shipment_number: 'DND-2026-000108',
    route_code: 'RT-0188',
    customer_id: 6,
    customer_name: 'PT IndoAgro Commodities',
    carrier_id: 2,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Elbe Trader · Voy 901W',
    origin_location_id: 3, // SGSIN
    destination_location_id: 6, // DEHAM
    cargo_type: 'Refined Coconut Oil Flexitanks',
    total_weight_kg: 84000,
    total_volume_cbm: 112,
    expected_departure: '2026-11-05T14:00:00Z',
    expected_arrival: '2026-11-26T08:00:00Z',
    estimated_arrival: '2026-11-26T08:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.PICKED_UP,
    created_at: '2026-11-03T11:00:00Z',
    updated_at: '2026-11-05T01:00:00Z',
  },
  {
    id: 109,
    shipment_number: 'DND-2026-000109',
    route_code: 'RT-0142',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 1,
    mode: TransportMode.SEA,
    vehicle_ref: 'MV Nusantara Pride · Voy 711W',
    origin_location_id: 1, // IDTPP
    destination_location_id: 5, // NLRTM
    cargo_type: 'High-Voltage Switchgear & Transformers',
    total_weight_kg: 76500,
    total_volume_cbm: 154,
    expected_departure: '2026-11-08T08:00:00Z',
    expected_arrival: '2026-11-30T16:00:00Z',
    estimated_arrival: '2026-11-30T16:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.CREATED,
    created_at: '2026-11-05T01:00:00Z',
    updated_at: '2026-11-05T01:00:00Z',
  },

  // --- AIR FREIGHT SHIPMENTS (13) ---
  {
    id: 201,
    shipment_number: 'DND-2026-000201',
    route_code: 'RT-0301',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 3, // Stratos Air Cargo
    mode: TransportMode.AIR,
    vehicle_ref: 'Flight ST-842 · Boeing 777F',
    origin_location_id: 7, // CGK Jakarta
    destination_location_id: 9, // AMS Schiphol
    cargo_type: 'Semiconductor Wafer Cassettes & Optical Sensors',
    total_weight_kg: 4850,
    total_volume_cbm: 28,
    expected_departure: '2026-11-04T16:00:00Z',
    expected_arrival: '2026-11-05T08:00:00Z',
    estimated_arrival: '2026-11-05T23:00:00Z', // +15h delay (MEDIUM, >12h threshold)
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-03T12:00:00Z',
    updated_at: '2026-11-05T02:00:00Z',
  },
  {
    id: 202,
    shipment_number: 'DND-2026-000202',
    route_code: 'RT-0305',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 4, // Archipelago AeroFreight
    mode: TransportMode.AIR,
    vehicle_ref: 'Flight AA-519 · Airbus A330-200F',
    origin_location_id: 8, // SIN Changi
    destination_location_id: 7, // CGK Jakarta
    cargo_type: 'Luxury Watches & High-Value Retail Launch Stock',
    total_weight_kg: 1920,
    total_volume_cbm: 14,
    expected_departure: '2026-11-03T04:00:00Z',
    expected_arrival: '2026-11-03T06:30:00Z',
    estimated_arrival: '2026-11-03T06:25:00Z',
    actual_arrival: '2026-11-03T06:25:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-11-01T15:00:00Z',
    updated_at: '2026-11-03T07:10:00Z',
  },
  {
    id: 203,
    shipment_number: 'DND-2026-000203',
    route_code: 'RT-0312',
    customer_id: 6,
    customer_name: 'PT IndoAgro Commodities',
    carrier_id: 3,
    mode: TransportMode.AIR,
    vehicle_ref: 'Flight ST-910 · Boeing 777F',
    origin_location_id: 7, // CGK Jakarta
    destination_location_id: 10, // SYD Sydney
    cargo_type: 'Chilled Tuna Loins & Tropical Cut Orchids',
    total_weight_kg: 6300,
    total_volume_cbm: 36,
    expected_departure: '2026-11-04T21:00:00Z',
    expected_arrival: '2026-11-05T06:00:00Z',
    estimated_arrival: '2026-11-05T06:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-03T18:00:00Z',
    updated_at: '2026-11-05T01:30:00Z',
  },
  {
    id: 204,
    shipment_number: 'DND-2026-000204',
    route_code: 'RT-0301',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 3,
    mode: TransportMode.AIR,
    vehicle_ref: 'Flight ST-844 · Boeing 777F',
    origin_location_id: 8, // SIN Changi
    destination_location_id: 9, // AMS Schiphol
    cargo_type: 'Biomedical Cold-Chain Reagents (2–8°C)',
    total_weight_kg: 3150,
    total_volume_cbm: 19,
    expected_departure: '2026-11-02T01:00:00Z',
    expected_arrival: '2026-11-02T14:30:00Z',
    estimated_arrival: '2026-11-02T14:15:00Z',
    actual_arrival: '2026-11-02T14:15:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-10-31T09:00:00Z',
    updated_at: '2026-11-02T15:00:00Z',
  },
  {
    id: 205,
    shipment_number: 'DND-2026-000205',
    route_code: 'RT-0318',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 4,
    mode: TransportMode.AIR,
    vehicle_ref: 'Flight AA-208 · Airbus A330-200F',
    origin_location_id: 9, // AMS Schiphol
    destination_location_id: 7, // CGK Jakarta
    cargo_type: 'European Cosmetics & Skincare Pallets',
    total_weight_kg: 5400,
    total_volume_cbm: 34,
    expected_departure: '2026-11-05T09:00:00Z',
    expected_arrival: '2026-11-06T03:00:00Z',
    estimated_arrival: '2026-11-06T03:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.PICKED_UP,
    created_at: '2026-11-04T08:00:00Z',
    updated_at: '2026-11-05T02:30:00Z',
  },
  {
    id: 206,
    shipment_number: 'DND-2026-000206',
    route_code: 'RT-0301',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 3,
    mode: TransportMode.AIR,
    vehicle_ref: 'Flight ST-846 · Boeing 777F',
    origin_location_id: 7, // CGK
    destination_location_id: 9, // AMS
    cargo_type: 'Aerospace Avionics Calibration Units',
    total_weight_kg: 2400,
    total_volume_cbm: 15,
    expected_departure: '2026-11-06T16:00:00Z',
    expected_arrival: '2026-11-07T08:00:00Z',
    estimated_arrival: '2026-11-07T08:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.BOOKED,
    created_at: '2026-11-04T14:00:00Z',
    updated_at: '2026-11-04T16:00:00Z',
  },

  // --- ROAD FREIGHT SHIPMENTS (14) ---
  {
    id: 301,
    shipment_number: 'DND-2026-000301',
    route_code: 'RT-0098',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 5, // Swift Haul Express
    mode: TransportMode.ROAD,
    vehicle_ref: 'B 9482 UXT · Mercedes Actros HGV Class 1',
    origin_location_id: 11, // IDCKG Cikarang
    destination_location_id: 13, // IDSLO Surakarta
    cargo_type: 'FMCG Packaged Groceries & Beverage Pallets',
    total_weight_kg: 18400,
    total_volume_cbm: 62,
    expected_departure: '2026-11-04T20:00:00Z',
    expected_arrival: '2026-11-05T07:00:00Z',
    estimated_arrival: '2026-11-05T07:00:00Z',
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-05T02:10:00Z',
  },
  {
    id: 302,
    shipment_number: 'DND-2026-000302',
    route_code: 'RT-0211',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 6, // Auto Route Freight
    mode: TransportMode.ROAD,
    vehicle_ref: 'B 9104 KJD · Ford Transit LCV Panel Van',
    origin_location_id: 1, // IDTPP Tanjung Priok
    destination_location_id: 12, // IDBDG Bandung Depot
    cargo_type: 'Imported Apparel & Department Store Fixtures',
    total_weight_kg: 7600,
    total_volume_cbm: 34,
    expected_departure: '2026-11-04T06:00:00Z',
    expected_arrival: '2026-11-04T12:00:00Z',
    estimated_arrival: '2026-11-04T11:45:00Z',
    actual_arrival: '2026-11-04T11:45:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-11-03T16:00:00Z',
    updated_at: '2026-11-04T12:00:00Z',
  },
  {
    id: 303,
    shipment_number: 'DND-2026-000303',
    route_code: 'RT-0245',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 7, // Trans Euro Carriers
    mode: TransportMode.ROAD,
    vehicle_ref: 'NL-88-BXR · Scania R450 HGV Class 2',
    origin_location_id: 5, // NLRTM Rotterdam Port
    destination_location_id: 14, // NLEIN Eindhoven Depot
    cargo_type: 'Container Drayage: Industrial Robotics Parts',
    total_weight_kg: 21500,
    total_volume_cbm: 67,
    expected_departure: '2026-11-04T08:00:00Z',
    expected_arrival: '2026-11-04T14:00:00Z',
    estimated_arrival: '2026-11-05T18:00:00Z', // +28h delay (HIGH, PORT_CONGESTION at Maasvlakte gate)
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-03T15:00:00Z',
    updated_at: '2026-11-05T02:00:00Z',
  },
  {
    id: 304,
    shipment_number: 'DND-2026-000304',
    route_code: 'RT-0219',
    customer_id: 6,
    customer_name: 'PT IndoAgro Commodities',
    carrier_id: 5,
    mode: TransportMode.ROAD,
    vehicle_ref: 'L 8821 UJ · Hino 500 Ranger Heavy Box',
    origin_location_id: 13, // IDSLO Surakarta
    destination_location_id: 2, // IDSUB Tanjung Perak Port
    cargo_type: 'Pre-carriage Export Cocoa Butter Drums',
    total_weight_kg: 16200,
    total_volume_cbm: 54,
    expected_departure: '2026-11-03T05:00:00Z',
    expected_arrival: '2026-11-03T13:00:00Z',
    estimated_arrival: '2026-11-03T12:30:00Z',
    actual_arrival: '2026-11-03T12:30:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-11-02T09:00:00Z',
    updated_at: '2026-11-03T13:00:00Z',
  },
  {
    id: 305,
    shipment_number: 'DND-2026-000305',
    route_code: 'RT-0211',
    customer_id: 4,
    customer_name: 'PT Nusantara Retail',
    carrier_id: 6,
    mode: TransportMode.ROAD,
    vehicle_ref: 'B 9712 TQA · Isuzu Giga Wingbox',
    origin_location_id: 11, // IDCKG Cikarang
    destination_location_id: 12, // IDBDG Bandung
    cargo_type: 'Home Furnishing & Kitchen Appliances',
    total_weight_kg: 12800,
    total_volume_cbm: 48,
    expected_departure: '2026-11-05T05:00:00Z',
    expected_arrival: '2026-11-05T10:00:00Z',
    estimated_arrival: '2026-11-05T14:00:00Z', // +4h delay (LOW)
    actual_arrival: null,
    status: ShipmentStatus.IN_TRANSIT,
    created_at: '2026-11-04T17:00:00Z',
    updated_at: '2026-11-05T03:00:00Z',
  },
  {
    id: 306,
    shipment_number: 'DND-2026-000306',
    route_code: 'RT-0245',
    customer_id: 5,
    customer_name: 'EuroTech Industrial B.V.',
    carrier_id: 7,
    mode: TransportMode.ROAD,
    vehicle_ref: 'NL-42-VTR · DAF XF 480 Euro 6',
    origin_location_id: 9, // AMS Schiphol Airport
    destination_location_id: 14, // NLEIN Eindhoven Depot
    cargo_type: 'Air-to-Road Bonded Lithography Spare Parts',
    total_weight_kg: 9400,
    total_volume_cbm: 32,
    expected_departure: '2026-11-02T16:00:00Z',
    expected_arrival: '2026-11-02T19:30:00Z',
    estimated_arrival: '2026-11-02T19:10:00Z',
    actual_arrival: '2026-11-02T19:10:00Z',
    status: ShipmentStatus.DELIVERED,
    created_at: '2026-11-01T18:00:00Z',
    updated_at: '2026-11-02T19:30:00Z',
  },
];

// Generate additional historical & active shipments (IDs 110..134) so total is 45 shipments
const EXTRA_SHIPMENTS_DEFINITIONS: Array<{
  id: number;
  num: string;
  route: string;
  custId: number;
  custName: string;
  carrierId: number;
  mode: TransportMode;
  veh: string;
  orig: number;
  dest: number;
  cargo: string;
  wt: number;
  vol: number;
  depOffsetHours: number;
  durHours: number;
  delayHours: number;
  status: ShipmentStatus;
}> = [
  { id: 110, num: 'DND-2026-000110', route: 'RT-0142', custId: 4, custName: 'PT Nusantara Retail', carrierId: 1, mode: TransportMode.SEA, veh: 'MV Ocean Pertiwi · Voy 406W', orig: 1, dest: 5, cargo: 'Footwear & Apparel Containers', wt: 34000, vol: 120, depOffsetHours: -420, durHours: 360, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 111, num: 'DND-2026-000111', route: 'RT-0142', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 2, mode: TransportMode.SEA, veh: 'MV Northern Meridian · Voy 117E', orig: 3, dest: 5, cargo: 'Automated Conveyor Modules', wt: 51000, vol: 140, depOffsetHours: -380, durHours: 340, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 112, num: 'DND-2026-000112', route: 'RT-0188', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 1, mode: TransportMode.SEA, veh: 'MV Krakatau Star · Voy 202N', orig: 2, dest: 6, cargo: 'Organic Cacao Nibs & Spices', wt: 62000, vol: 155, depOffsetHours: -350, durHours: 320, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 113, num: 'DND-2026-000113', route: 'RT-0160', custId: 4, custName: 'PT Nusantara Retail', carrierId: 1, mode: TransportMode.SEA, veh: 'MV Java Pioneer · Voy 507N', orig: 1, dest: 3, cargo: 'Retail Packaging & Display Units', wt: 19500, vol: 76, depOffsetHours: -240, durHours: 48, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 114, num: 'DND-2026-000114', route: 'RT-0109', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 2, mode: TransportMode.SEA, veh: 'MV Sunda Strait · Voy 810S', orig: 4, dest: 1, cargo: 'Agricultural Fertilizer Pellets', wt: 78000, vol: 170, depOffsetHours: -210, durHours: 72, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 115, num: 'DND-2026-000115', route: 'RT-0155', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 2, mode: TransportMode.SEA, veh: 'MV Friesland Express · Voy 609W', orig: 2, dest: 5, cargo: ' Aluminum Extrusion Profiles', wt: 46000, vol: 110, depOffsetHours: -190, durHours: 240, delayHours: 0, status: ShipmentStatus.IN_TRANSIT },
  { id: 116, num: 'DND-2026-000116', route: 'RT-0160', custId: 4, custName: 'PT Nusantara Retail', carrierId: 1, mode: TransportMode.SEA, veh: 'MV Java Pioneer · Voy 508N', orig: 3, dest: 1, cargo: 'Commercial Kitchen Equipment', wt: 28000, vol: 95, depOffsetHours: -140, durHours: 50, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 117, num: 'DND-2026-000117', route: 'RT-0142', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 2, mode: TransportMode.SEA, veh: 'MV Baltic Vanguard · Voy 307W', orig: 1, dest: 5, cargo: 'Electric Motor Stators', wt: 53000, vol: 128, depOffsetHours: -96, durHours: 360, delayHours: 0, status: ShipmentStatus.IN_TRANSIT },
  { id: 118, num: 'DND-2026-000118', route: 'RT-0109', custId: 4, custName: 'PT Nusantara Retail', carrierId: 1, mode: TransportMode.SEA, veh: 'MV Sunda Strait · Voy 814S', orig: 4, dest: 2, cargo: 'Polymer Packaging Film Rolls', wt: 33500, vol: 98, depOffsetHours: -48, durHours: 80, delayHours: 0, status: ShipmentStatus.IN_TRANSIT },
  { id: 119, num: 'DND-2026-000207', route: 'RT-0301', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 3, mode: TransportMode.AIR, veh: 'Flight ST-838 · Boeing 777F', orig: 7, dest: 9, cargo: 'Industrial PLC Controllers', wt: 3200, vol: 21, depOffsetHours: -168, durHours: 16, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 120, num: 'DND-2026-000208', route: 'RT-0305', custId: 4, custName: 'PT Nusantara Retail', carrierId: 4, mode: TransportMode.AIR, veh: 'Flight AA-515 · Airbus A330-200F', orig: 8, dest: 7, cargo: 'Flagship Smartphone Launch Consignment', wt: 4100, vol: 26, depOffsetHours: -144, durHours: 3, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 121, num: 'DND-2026-000209', route: 'RT-0312', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 3, mode: TransportMode.AIR, veh: 'Flight ST-906 · Boeing 777F', orig: 7, dest: 10, cargo: 'Fresh Mangosteen & Vanilla Pods', wt: 5200, vol: 31, depOffsetHours: -120, durHours: 9, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 122, num: 'DND-2026-000210', route: 'RT-0318', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 4, mode: TransportMode.AIR, veh: 'Flight AA-204 · Airbus A330-200F', orig: 9, dest: 8, cargo: 'Cleanroom Robotics Grippers', wt: 2750, vol: 18, depOffsetHours: -90, durHours: 13, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 123, num: 'DND-2026-000211', route: 'RT-0305', custId: 4, custName: 'PT Nusantara Retail', carrierId: 4, mode: TransportMode.AIR, veh: 'Flight AA-521 · Airbus A330-200F', orig: 8, dest: 7, cargo: 'Optical Eyewear & Medical Frames', wt: 1450, vol: 11, depOffsetHours: -60, durHours: 3, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 124, num: 'DND-2026-000212', route: 'RT-0312', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 3, mode: TransportMode.AIR, veh: 'Flight ST-912 · Boeing 777F', orig: 8, dest: 10, cargo: 'Roast Arabica Sample Lots', wt: 1800, vol: 12, depOffsetHours: -18, durHours: 8, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 125, num: 'DND-2026-000213', route: 'RT-0301', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 3, mode: TransportMode.AIR, veh: 'Flight ST-845 · Boeing 777F', orig: 7, dest: 9, cargo: 'Laser Interferometer Modules', wt: 2100, vol: 14, depOffsetHours: -6, durHours: 16, delayHours: 0, status: ShipmentStatus.IN_TRANSIT },
  { id: 126, num: 'DND-2026-000307', route: 'RT-0098', custId: 4, custName: 'PT Nusantara Retail', carrierId: 5, mode: TransportMode.ROAD, veh: 'B 9480 UXT · Mercedes Actros HGV Class 1', orig: 11, dest: 13, cargo: 'Retail Distribution Center Replenishment', wt: 17500, vol: 60, depOffsetHours: -160, durHours: 11, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 127, num: 'DND-2026-000308', route: 'RT-0211', custId: 4, custName: 'PT Nusantara Retail', carrierId: 6, mode: TransportMode.ROAD, veh: 'B 9108 KJD · Ford Transit LCV Panel Van', orig: 1, dest: 12, cargo: 'Textiles & Home Linens', wt: 6800, vol: 30, depOffsetHours: -130, durHours: 6, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 128, num: 'DND-2026-000309', route: 'RT-0245', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 7, mode: TransportMode.ROAD, veh: 'NL-91-BXR · Scania R450 HGV Class 2', orig: 5, dest: 14, cargo: 'Bonded Customs Container Drayage', wt: 22400, vol: 66, depOffsetHours: -110, durHours: 4, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 129, num: 'DND-2026-000310', route: 'RT-0219', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 5, mode: TransportMode.ROAD, veh: 'L 8825 UJ · Hino 500 Ranger Heavy Box', orig: 13, dest: 2, cargo: 'Processed Cassava Starch Pallets', wt: 19200, vol: 58, depOffsetHours: -84, durHours: 8, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 130, num: 'DND-2026-000311', route: 'RT-0098', custId: 4, custName: 'PT Nusantara Retail', carrierId: 5, mode: TransportMode.ROAD, veh: 'B 9485 UXT · Mercedes Actros HGV Class 1', orig: 11, dest: 13, cargo: 'Bottled Beverages & Dry Goods', wt: 18900, vol: 64, depOffsetHours: -52, durHours: 11, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 131, num: 'DND-2026-000312', route: 'RT-0211', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 6, mode: TransportMode.ROAD, veh: 'D 8192 VBN · Isuzu Giga Wingbox', orig: 12, dest: 1, cargo: 'West Java Highland Tea Chests', wt: 14200, vol: 50, depOffsetHours: -28, durHours: 6, delayHours: 0, status: ShipmentStatus.DELIVERED },
  { id: 132, num: 'DND-2026-000313', route: 'RT-0245', custId: 5, custName: 'EuroTech Industrial B.V.', carrierId: 7, mode: TransportMode.ROAD, veh: 'NL-55-VTR · DAF XF 480 Euro 6', orig: 14, dest: 5, cargo: 'Export Machinery Crates to Maasvlakte', wt: 20100, vol: 61, depOffsetHours: -8, durHours: 12, delayHours: 0, status: ShipmentStatus.IN_TRANSIT },
  { id: 133, num: 'DND-2026-000314', route: 'RT-0098', custId: 4, custName: 'PT Nusantara Retail', carrierId: 5, mode: TransportMode.ROAD, veh: 'B 9499 UXT · Mercedes Actros HGV Class 1', orig: 11, dest: 2, cargo: 'Inter-Depot Fast Moving Consumer Goods', wt: 19600, vol: 65, depOffsetHours: -4, durHours: 14, delayHours: 0, status: ShipmentStatus.IN_TRANSIT },
  { id: 134, num: 'DND-2026-000315', route: 'RT-0219', custId: 6, custName: 'PT IndoAgro Commodities', carrierId: 6, mode: TransportMode.ROAD, veh: 'L 8890 UJ · Hino 500 Ranger Heavy Box', orig: 13, dest: 11, cargo: 'Packaged Nutmeg & Clove Export Sacks', wt: 15800, vol: 52, depOffsetHours: 12, durHours: 10, delayHours: 0, status: ShipmentStatus.BOOKED },
];

const ANCHOR_MS = new Date('2026-11-05T03:30:00Z').getTime();

export const ALL_SEED_SHIPMENTS: Shipment[] = [
  ...SEED_SHIPMENTS,
  ...EXTRA_SHIPMENTS_DEFINITIONS.map((d) => {
    const depIso = new Date(ANCHOR_MS + d.depOffsetHours * 3600000).toISOString();
    const expArrIso = new Date(
      ANCHOR_MS + (d.depOffsetHours + d.durHours) * 3600000
    ).toISOString();
    const estArrIso = new Date(
      ANCHOR_MS + (d.depOffsetHours + d.durHours + d.delayHours) * 3600000
    ).toISOString();
    return {
      id: d.id,
      shipment_number: d.num,
      route_code: d.route,
      customer_id: d.custId,
      customer_name: d.custName,
      carrier_id: d.carrierId,
      mode: d.mode,
      vehicle_ref: d.veh,
      origin_location_id: d.orig,
      destination_location_id: d.dest,
      cargo_type: d.cargo,
      total_weight_kg: d.wt,
      total_volume_cbm: d.vol,
      expected_departure: depIso,
      expected_arrival: expArrIso,
      estimated_arrival: estArrIso,
      actual_arrival: d.status === ShipmentStatus.DELIVERED ? estArrIso : null,
      status: d.status,
      created_at: new Date(ANCHOR_MS + (d.depOffsetHours - 24) * 3600000).toISOString(),
      updated_at: new Date(ANCHOR_MS - 3600000).toISOString(),
    };
  }),
];

export const SEED_SHIPMENT_ITEMS: ShipmentItem[] = [
  {
    id: 1,
    shipment_id: 101,
    sku: 'NRT-OLED-55',
    description: '4K OLED Smart Television Panels (40ft HC Container)',
    quantity: 2,
    unit_type: 'TEU',
    weight_kg: 24500,
    volume_cbm: 76,
    hs_code: '8528.72.10',
  },
  {
    id: 2,
    shipment_id: 101,
    sku: 'NRT-INV-AC',
    description: 'Split-System Inverter Air Conditioning Units',
    quantity: 2,
    unit_type: 'TEU',
    weight_kg: 18000,
    volume_cbm: 56,
    hs_code: '8415.10.90',
  },
  {
    id: 3,
    shipment_id: 103,
    sku: 'IAG-ARA-G1',
    description: 'Sumatra Mandheling Grade-1 Arabica Beans (60kg Jute Bags)',
    quantity: 6,
    unit_type: 'TEU',
    weight_kg: 108000,
    volume_cbm: 198,
    hs_code: '0901.11.10',
  },
  {
    id: 4,
    shipment_id: 201,
    sku: 'ET-WAF-300',
    description: '300mm Silicon Wafer FOUP Shock-Isolated Crates',
    quantity: 12,
    unit_type: 'CRATE',
    weight_kg: 4850,
    volume_cbm: 28,
    hs_code: '8541.49.00',
  },
  {
    id: 5,
    shipment_id: 301,
    sku: 'NRT-FMCG-88',
    description: 'Shrink-Wrapped Retail Beverage & Staple Pallets',
    quantity: 32,
    unit_type: 'PALLET',
    weight_kg: 18400,
    volume_cbm: 62,
    hs_code: '2202.10.00',
  },
  ...ALL_SEED_SHIPMENTS.filter(
    (sh) => ![101, 103, 201, 301].includes(sh.id)
  ).map((sh, idx) => ({
    id: 100 + idx,
    shipment_id: sh.id,
    sku: `${sh.mode}-SKU-${sh.id}`,
    description: sh.cargo_type,
    quantity: sh.mode === TransportMode.SEA ? 4 : sh.mode === TransportMode.AIR ? 8 : 24,
    unit_type: (sh.mode === TransportMode.SEA
      ? 'TEU'
      : sh.mode === TransportMode.AIR
      ? 'CRATE'
      : 'PALLET') as 'TEU' | 'CRATE' | 'PALLET',
    weight_kg: sh.total_weight_kg,
    volume_cbm: sh.total_volume_cbm,
    hs_code:
      sh.mode === TransportMode.SEA
        ? '8479.89.90'
        : sh.mode === TransportMode.AIR
        ? '8542.31.00'
        : '3923.10.00',
  })),
];

const EXPLICIT_TRACKING_EVENTS: TrackingEvent[] = [
  // Shipment 101 (SEA: IDTPP -> NLRTM, Delayed +16h)
  {
    id: 1001,
    shipment_id: 101,
    event_type: 'BOOKING_CONFIRMED',
    status_after: ShipmentStatus.BOOKED,
    event_timestamp: '2026-10-16T09:00:00Z',
    location_id: 1,
    location_name: 'Port of Tanjung Priok, Jakarta',
    latitude: -6.1045,
    longitude: 106.8805,
    description: 'Ocean container slot confirmed aboard MV Ocean Pertiwi (Voyage 408W).',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1002,
    shipment_id: 101,
    event_type: 'LOADED_ON_VESSEL',
    status_after: ShipmentStatus.PICKED_UP,
    event_timestamp: '2026-10-18T05:30:00Z',
    location_id: 1,
    location_name: 'JICT Terminal 1, Port of Tanjung Priok',
    latitude: -6.1045,
    longitude: 106.8805,
    description: '4x20ft TEU containers gated in and loaded onto Bay 14.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1003,
    shipment_id: 101,
    event_type: 'DEPARTED_PORT',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-10-18T08:45:00Z',
    location_id: 1,
    location_name: 'Port of Tanjung Priok, Jakarta',
    latitude: -6.1045,
    longitude: 106.8805,
    description: 'Vessel departed berth bound for Singapore transshipment and Rotterdam.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1004,
    shipment_id: 101,
    event_type: 'ARRIVED_PORT',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-10-20T04:15:00Z',
    location_id: 3,
    location_name: 'Port of Singapore (Tuas Terminal)',
    latitude: 1.2644,
    longitude: 103.8405,
    description: 'Scheduled bunker call and feeder consolidation completed at Tuas.',
    is_exception: false,
    created_by_user_id: 3,
    created_by_name: 'Siti Rahmawati',
  },
  {
    id: 1005,
    shipment_id: 101,
    event_type: 'EXCEPTION_REPORTED',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-11-04T14:20:00Z',
    location_id: null,
    location_name: 'English Channel Approach (49.85°N, 2.10°W)',
    latitude: 49.85,
    longitude: -2.1,
    description: 'Customs manifest secondary inspection hold notification received prior to Rotterdam Maasvlakte berth window (+16h ETA revision).',
    is_exception: true,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },

  // Shipment 103 (SEA: IDSUB -> DEHAM, Delayed +44h CUSTOMS_HOLD)
  {
    id: 1006,
    shipment_id: 103,
    event_type: 'BOOKING_CONFIRMED',
    status_after: ShipmentStatus.BOOKED,
    event_timestamp: '2026-10-10T11:00:00Z',
    location_id: 2,
    location_name: 'Port of Tanjung Perak, Surabaya',
    latitude: -7.1995,
    longitude: 112.733,
    description: 'Phytosanitary export booking confirmed for 6x20ft Arabica coffee containers.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1007,
    shipment_id: 103,
    event_type: 'LOADED_ON_VESSEL',
    status_after: ShipmentStatus.PICKED_UP,
    event_timestamp: '2026-10-12T04:00:00Z',
    location_id: 2,
    location_name: 'Port of Tanjung Perak, Surabaya',
    latitude: -7.1995,
    longitude: 112.733,
    description: 'Loaded onto MV Krakatau Star.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1008,
    shipment_id: 103,
    event_type: 'DEPARTED_PORT',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-10-12T06:30:00Z',
    location_id: 2,
    location_name: 'Port of Tanjung Perak, Surabaya',
    latitude: -7.1995,
    longitude: 112.733,
    description: 'Departed Surabaya bound for Port of Hamburg.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1009,
    shipment_id: 103,
    event_type: 'EXCEPTION_REPORTED',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-11-03T09:15:00Z',
    location_id: 6,
    location_name: 'Port of Hamburg Customs Anchorage',
    latitude: 53.5413,
    longitude: 9.984,
    description: 'CUSTOMS_HOLD: EU phytosanitary certificate physical verification required by Zollamt Hamburg. Estimated arrival pushed by +44 hours.',
    is_exception: true,
    created_by_user_id: 3,
    created_by_name: 'Siti Rahmawati',
  },

  // Shipment 201 (AIR: CGK -> AMS)
  {
    id: 1010,
    shipment_id: 201,
    event_type: 'ACCEPTED_AT_ORIGIN',
    status_after: ShipmentStatus.PICKED_UP,
    event_timestamp: '2026-11-04T12:30:00Z',
    location_id: 7,
    location_name: 'Soekarno-Hatta Cargo Terminal (CGK)',
    latitude: -6.1256,
    longitude: 106.6558,
    description: 'ULD pallets built and X-ray screened at CGK RA- Regulated Agent facility.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1011,
    shipment_id: 201,
    event_type: 'DEPARTED_AIRPORT',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-11-04T16:20:00Z',
    location_id: 7,
    location_name: 'Soekarno-Hatta Cargo Terminal (CGK)',
    latitude: -6.1256,
    longitude: 106.6558,
    description: 'Flight ST-842 airborne from Runway 25R.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1012,
    shipment_id: 201,
    event_type: 'EXCEPTION_REPORTED',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-11-05T01:10:00Z',
    location_id: null,
    location_name: 'Doha Technical Stopover Hub (25.27°N, 51.60°E)',
    latitude: 25.273,
    longitude: 51.608,
    description: 'WEATHER_DELAY: Crosswind and dense fog slot restrictions at Amsterdam Schiphol delayed connecting leg departure by +15 hours.',
    is_exception: true,
    created_by_user_id: 3,
    created_by_name: 'Siti Rahmawati',
  },

  // Shipment 301 (ROAD: IDCKG Cikarang -> IDSLO Surakarta)
  {
    id: 1013,
    shipment_id: 301,
    event_type: 'PICKED_UP_FROM_SHIPPER',
    status_after: ShipmentStatus.PICKED_UP,
    event_timestamp: '2026-11-04T19:15:00Z',
    location_id: 11,
    location_name: 'Cikarang Dry Port & Logistics Park',
    latitude: -6.2845,
    longitude: 107.1485,
    description: '32 pallets loaded and sealed onto Mercedes Actros HGV B 9482 UXT.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1014,
    shipment_id: 301,
    event_type: 'DEPARTED_DEPOT',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-11-04T20:05:00Z',
    location_id: 11,
    location_name: 'Cikarang Dry Port & Logistics Park',
    latitude: -6.2845,
    longitude: 107.1485,
    description: 'Dispatched via Trans-Java Toll Road E-Corridor.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
  {
    id: 1015,
    shipment_id: 301,
    event_type: 'LOCATION_UPDATE',
    status_after: ShipmentStatus.IN_TRANSIT,
    event_timestamp: '2026-11-05T01:45:00Z',
    location_id: null,
    location_name: 'Semarang Kalikangkung Toll Gate Checkpoint',
    latitude: -6.985,
    longitude: 110.355,
    description: 'Driver mandatory rest break completed; 95 km remaining to Surakarta hub.',
    is_exception: false,
    created_by_user_id: 2,
    created_by_name: 'Budiono Siregar',
  },
];

// Generate chronological tracking events for all remaining shipments so every single shipment has a complete timeline
function buildGeneratedTrackingEvents(): TrackingEvent[] {
  const locMap = new Map(SEED_LOCATIONS.map((l) => [l.id, l]));
  const explicitIds = new Set([101, 103, 201, 301]);
  const generated: TrackingEvent[] = [];
  let nextEventId = 2000;

  for (const sh of ALL_SEED_SHIPMENTS) {
    if (explicitIds.has(sh.id)) continue;
    const orig = locMap.get(sh.origin_location_id) || SEED_LOCATIONS[0];
    const dest = locMap.get(sh.destination_location_id) || SEED_LOCATIONS[4];
    const depMs = new Date(sh.expected_departure).getTime();
    const arrMs = new Date(sh.estimated_arrival).getTime();

    // 1. Booking / Order Registration Event
    generated.push({
      id: nextEventId++,
      shipment_id: sh.id,
      event_type: 'BOOKING_CONFIRMED',
      status_after:
        sh.status === ShipmentStatus.CREATED
          ? ShipmentStatus.CREATED
          : ShipmentStatus.BOOKED,
      event_timestamp: new Date(depMs - 12 * 3600000).toISOString(),
      location_id: orig.id,
      location_name: `${orig.name} (${orig.city})`,
      latitude: orig.latitude,
      longitude: orig.longitude,
      description: `Booking confirmed at ${orig.code} (${sh.vehicle_ref}) for ${sh.cargo_type}.`,
      is_exception: false,
      created_by_user_id: 2,
      created_by_name: 'Budiono Siregar',
    });

    if (
      sh.status === ShipmentStatus.PICKED_UP ||
      sh.status === ShipmentStatus.IN_TRANSIT ||
      sh.status === ShipmentStatus.DELIVERED
    ) {
      const pickupEventType =
        sh.mode === TransportMode.SEA
          ? 'LOADED_ON_VESSEL'
          : sh.mode === TransportMode.AIR
          ? 'ACCEPTED_AT_ORIGIN'
          : 'PICKED_UP_FROM_SHIPPER';
      generated.push({
        id: nextEventId++,
        shipment_id: sh.id,
        event_type: pickupEventType,
        status_after: ShipmentStatus.PICKED_UP,
        event_timestamp: new Date(depMs - 2 * 3600000).toISOString(),
        location_id: orig.id,
        location_name: `${orig.name} (${orig.city})`,
        latitude: orig.latitude,
        longitude: orig.longitude,
        description: `Cargo gated in, weighed (${sh.total_weight_kg.toLocaleString()} kg), and loaded onto ${sh.vehicle_ref}.`,
        is_exception: false,
        created_by_user_id: 2,
        created_by_name: 'Budiono Siregar',
      });
    }

    if (
      sh.status === ShipmentStatus.IN_TRANSIT ||
      sh.status === ShipmentStatus.DELIVERED
    ) {
      const departEventType =
        sh.mode === TransportMode.SEA
          ? 'DEPARTED_PORT'
          : sh.mode === TransportMode.AIR
          ? 'DEPARTED_AIRPORT'
          : 'DEPARTED_DEPOT';
      const midLat = Number(((orig.latitude + dest.latitude) / 2).toFixed(4));
      const midLng = Number(((orig.longitude + dest.longitude) / 2).toFixed(4));
      generated.push({
        id: nextEventId++,
        shipment_id: sh.id,
        event_type: departEventType,
        status_after: ShipmentStatus.IN_TRANSIT,
        event_timestamp: new Date(depMs).toISOString(),
        location_id: orig.id,
        location_name: `${orig.city} → ${dest.city} Corridor (${orig.code})`,
        latitude: sh.status === ShipmentStatus.IN_TRANSIT ? midLat : orig.latitude,
        longitude: sh.status === ShipmentStatus.IN_TRANSIT ? midLng : orig.longitude,
        description: `Departed ${orig.name} en route to ${dest.name} (${dest.code}).`,
        is_exception: false,
        created_by_user_id: 3,
        created_by_name: 'Siti Rahmawati',
      });
    }

    if (sh.status === ShipmentStatus.DELIVERED) {
      const delivEventType =
        sh.mode === TransportMode.SEA
          ? 'DISCHARGED'
          : sh.mode === TransportMode.AIR
          ? 'CLEARED_FOR_PICKUP'
          : 'ARRIVED_DEPOT';
      generated.push({
        id: nextEventId++,
        shipment_id: sh.id,
        event_type: delivEventType,
        status_after: ShipmentStatus.DELIVERED,
        event_timestamp: new Date(arrMs).toISOString(),
        location_id: dest.id,
        location_name: `${dest.name} (${dest.city})`,
        latitude: dest.latitude,
        longitude: dest.longitude,
        description: `Consignment arrived at ${dest.name} (${dest.code}); proof of delivery signed and verified.`,
        is_exception: false,
        created_by_user_id: 2,
        created_by_name: 'Budiono Siregar',
      });
    }
  }

  return generated;
}

export const SEED_TRACKING_EVENTS: TrackingEvent[] = [
  ...EXPLICIT_TRACKING_EVENTS,
  ...buildGeneratedTrackingEvents(),
];

export const SEED_EXCEPTIONS: ShipmentException[] = [
  {
    id: 501,
    shipment_id: 103,
    shipment_number: 'DND-2026-000103',
    exception_type: ExceptionType.CUSTOMS_HOLD,
    severity: SeverityLevel.HIGH,
    status: ExceptionStatus.OPEN,
    title: 'EU Phytosanitary Certificate Physical Inspection Hold',
    description:
      'Zollamt Hamburg flagged 2 of 6 TEU containers for physical sampling and original Indonesian Ministry of Agriculture endorsement verification.',
    resolution_notes: null,
    detected_at: '2026-11-03T09:15:00Z',
    resolved_at: null,
    reported_by_user_id: 3,
    reported_by_name: 'Siti Rahmawati',
  },
  {
    id: 502,
    shipment_id: 101,
    shipment_number: 'DND-2026-000101',
    exception_type: ExceptionType.CUSTOMS_HOLD,
    severity: SeverityLevel.MEDIUM,
    status: ExceptionStatus.INVESTIGATING,
    title: 'Rotterdam ENS Entry Summary Declaration HS-Code Review',
    description:
      'Dutch Customs automated risk engine requested commercial invoice line-item verification for HS 8528.72.10 smart displays.',
    resolution_notes: ' Customs broker uploaded legalized EUR.1 & packing list; awaiting release stamp.',
    detected_at: '2026-11-04T14:20:00Z',
    resolved_at: null,
    reported_by_user_id: 2,
    reported_by_name: 'Budiono Siregar',
  },
  {
    id: 503,
    shipment_id: 201,
    shipment_number: 'DND-2026-000201',
    exception_type: ExceptionType.WEATHER_DELAY,
    severity: SeverityLevel.MEDIUM,
    status: ExceptionStatus.INVESTIGATING,
    title: 'Schiphol Low-Visibility Runway Slot Restriction',
    description:
      'Dense North Sea fog reduced landing capacity at AMS; Flight ST-842 held at technical stopover for revised arrival slot.',
    resolution_notes: 'New landing slot confirmed for 23:00 UTC.',
    detected_at: '2026-11-05T01:10:00Z',
    resolved_at: null,
    reported_by_user_id: 3,
    reported_by_name: 'Siti Rahmawati',
  },
  {
    id: 504,
    shipment_id: 303,
    shipment_number: 'DND-2026-000303',
    exception_type: ExceptionType.PORT_CONGESTION,
    severity: SeverityLevel.HIGH,
    status: ExceptionStatus.OPEN,
    title: 'Maasvlakte Automated Straddle Carrier Queue Congestion',
    description:
      'Landside truck gate turnaround times exceeded 9 hours due to crane maintenance at Rotterdam APM Terminal.',
    resolution_notes: null,
    detected_at: '2026-11-04T11:30:00Z',
    resolved_at: null,
    reported_by_user_id: 2,
    reported_by_name: 'Budiono Siregar',
  },
  {
    id: 505,
    shipment_id: 107,
    shipment_number: 'DND-2026-000107',
    exception_type: ExceptionType.DOCUMENTATION_ISSUE,
    severity: SeverityLevel.LOW,
    status: ExceptionStatus.OPEN,
    title: 'Consignee Tax ID Amendment on Sea Waybill',
    description:
      'Minor typographical correction requested on electronic Sea Waybill prior to Tuas berth arrival.',
    resolution_notes: null,
    detected_at: '2026-11-04T22:00:00Z',
    resolved_at: null,
    reported_by_user_id: 2,
    reported_by_name: 'Budiono Siregar',
  },
  {
    id: 506,
    shipment_id: 105,
    shipment_number: 'DND-2026-000105',
    exception_type: ExceptionType.DAMAGED,
    severity: SeverityLevel.LOW,
    status: ExceptionStatus.RESOLVED,
    title: 'Outer Shrink-Wrap Scuff on Pallet #14',
    description:
      'External moisture barrier film torn during discharge; internal inverter cabinet inspected and verified intact.',
    resolution_notes: 'Repacked and signed off clean on Proof of Delivery (POD).',
    detected_at: '2026-10-29T10:00:00Z',
    resolved_at: '2026-10-29T15:30:00Z',
    reported_by_user_id: 2,
    reported_by_name: 'Budiono Siregar',
  },
];

export const SEED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 901,
    user_id: 6, // PT IndoAgro Commodities
    shipment_id: 103,
    shipment_number: 'DND-2026-000103',
    type: 'EXCEPTION_OPENED',
    title: 'Customs Hold Reported on DND-2026-000103',
    message:
      'HIGH severity CUSTOMS_HOLD opened at Port of Hamburg. Delay is +44h (exceeds Group A 12h threshold).',
    is_read: false,
    created_at: '2026-11-03T09:16:00Z',
  },
  {
    id: 902,
    user_id: 4, // PT Nusantara Retail
    shipment_id: 101,
    shipment_number: 'DND-2026-000101',
    type: 'DELAY_DETECTED',
    title: 'Delay Threshold Exceeded: DND-2026-000101 (+16h)',
    message:
      'Estimated arrival revised to 05 Nov 2026, 22:00 UTC (+16.0h delta vs 12h Group A threshold).',
    is_read: false,
    created_at: '2026-11-04T14:21:00Z',
  },
  {
    id: 903,
    user_id: 5, // EuroTech Industrial B.V.
    shipment_id: 201,
    shipment_number: 'DND-2026-000201',
    type: 'DELAY_DETECTED',
    title: 'Air Freight Weather Delay: DND-2026-000201 (+15h)',
    message:
      'Flight ST-842 held due to Schiphol fog slot restrictions. Revised ETA: 05 Nov 2026, 23:00 UTC.',
    is_read: false,
    created_at: '2026-11-05T01:12:00Z',
  },
  {
    id: 904,
    user_id: 4,
    shipment_id: 302,
    shipment_number: 'DND-2026-000302',
    type: 'STATUS_CHANGED',
    title: 'Shipment Delivered: DND-2026-000302',
    message:
      'Road consignment arrived at Bandung Gedebage Inland Depot ahead of schedule.',
    is_read: true,
    created_at: '2026-11-04T11:46:00Z',
  },
];

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 707,
    actor_user_id: 2,
    actor_name: 'Budiono Siregar',
    actor_role: UserRole.OPERATOR,
    action: 'STATUS_TRANSITION',
    entity_type: 'Shipment',
    entity_id: 'DND-2026-000102',
    summary: 'Verified vessel departure for DND-2026-000102 aboard MV Northern Meridian from Port of Singapore (SGSIN) en route to Rotterdam (NLRTM).',
    old_values: { status: 'PICKED_UP' },
    new_values: { status: 'IN_TRANSIT', event_type: 'DEPARTED_PORT' },
    created_at: '2026-11-05T06:40:00Z',
  },
  {
    id: 706,
    actor_user_id: 3,
    actor_name: 'Siti Rahmawati',
    actor_role: UserRole.OPERATOR,
    action: 'EXCEPTION_REPORTED',
    entity_type: 'ShipmentException',
    entity_id: 'DND-2026-000201',
    summary: 'Logged MEDIUM severity WEATHER_DELAY on Air Freight DND-2026-000201 due to Schiphol (AMS) low-visibility runway slot restriction (+15h ETA revision).',
    old_values: { estimated_arrival: '2026-11-05T08:00:00Z' },
    new_values: { exception_type: 'WEATHER_DELAY', severity: 'MEDIUM', estimated_arrival: '2026-11-05T23:00:00Z' },
    created_at: '2026-11-05T01:10:00Z',
  },
  {
    id: 705,
    actor_user_id: 2,
    actor_name: 'Budiono Siregar',
    actor_role: UserRole.OPERATOR,
    action: 'STATUS_TRANSITION',
    entity_type: 'Shipment',
    entity_id: 'DND-2026-000301',
    summary: 'Transitioned overland road freight DND-2026-000301 from PICKED_UP to IN_TRANSIT via DEPARTED_DEPOT checkpoint at Cikarang Dry Port.',
    old_values: { status: 'PICKED_UP' },
    new_values: { status: 'IN_TRANSIT', event_type: 'DEPARTED_DEPOT' },
    created_at: '2026-11-04T20:05:00Z',
  },
  {
    id: 704,
    actor_user_id: 2,
    actor_name: 'Budiono Siregar',
    actor_role: UserRole.OPERATOR,
    action: 'EXCEPTION_REPORTED',
    entity_type: 'ShipmentException',
    entity_id: 'DND-2026-000101',
    summary: 'Flagged MEDIUM severity CUSTOMS_HOLD on DND-2026-000101 for Rotterdam ENS Entry Summary Declaration HS-Code verification (+16h ETA delta).',
    old_values: { estimated_arrival: '2026-11-05T06:00:00Z' },
    new_values: { exception_type: 'CUSTOMS_HOLD', severity: 'MEDIUM', estimated_arrival: '2026-11-05T22:00:00Z' },
    created_at: '2026-11-04T14:20:00Z',
  },
  {
    id: 703,
    actor_user_id: 3,
    actor_name: 'Siti Rahmawati',
    actor_role: UserRole.OPERATOR,
    action: 'EXCEPTION_REPORTED',
    entity_type: 'ShipmentException',
    entity_id: 'DND-2026-000103',
    summary: 'Opened HIGH severity CUSTOMS_HOLD on DND-2026-000103 at Port of Hamburg (DEHAM) for EU Phytosanitary physical container inspection.',
    old_values: { estimated_arrival: '2026-11-03T12:00:00Z' },
    new_values: { exception_type: 'CUSTOMS_HOLD', severity: 'HIGH', estimated_arrival: '2026-11-05T08:00:00Z' },
    created_at: '2026-11-03T09:15:00Z',
  },
  {
    id: 702,
    actor_user_id: 2,
    actor_name: 'Budiono Siregar',
    actor_role: UserRole.OPERATOR,
    action: 'EXCEPTION_RESOLVED',
    entity_type: 'ShipmentException',
    entity_id: 'DND-2026-000105',
    summary: 'Resolved outer shrink-wrap packaging exception on DND-2026-000105 after discharge inspection and signed clean Proof of Delivery.',
    old_values: { status: 'OPEN' },
    new_values: { status: 'RESOLVED', resolution_notes: 'Repacked and signed off clean on POD.' },
    created_at: '2026-10-29T15:30:00Z',
  },
  {
    id: 701,
    actor_user_id: 1,
    actor_name: 'Rendra Wijaya',
    actor_role: UserRole.ADMIN,
    action: 'GROUP_CONFIG_INITIALIZED',
    entity_type: 'Settings',
    entity_id: 'group_a_config',
    summary: 'Configured Group A parameters: Route Southeast Asia → Europe, Delay Threshold = 12h, Main Exception = CUSTOMS_HOLD.',
    old_values: null,
    new_values: { delay_threshold_hours: 12, main_exception_focus: 'CUSTOMS_HOLD' },
    created_at: '2026-10-01T08:00:00Z',
  },
];

