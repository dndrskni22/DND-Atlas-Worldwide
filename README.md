# CargoTrace – Global Shipment Visibility & Tracking Platform

> **Web Programming 2 Final Project (UAS)**  
> Multimodal Logistics Visibility Platform covering **Sea Freight (`SEA`)**, **Air Freight (`AIR`)**, and **Road Freight (`ROAD`)** with deterministic ETA & delay evaluation, append-only tracking timelines, role-based access control (`ADMIN`, `OPERATOR`, `CUSTOMER`), interactive OpenStreetMap/Leaflet.js route visualization, and real-time Open-Meteo destination weather telemetry.

---

## 1. Problem Statement & Project Scope (Brief Slides 3–10)

Global logistics teams and B2B cargo owners frequently suffer from fragmented tracking across ocean vessels, air cargo flights, and overland trucking fleets. **CargoTrace** solves this by providing a unified, single-source-of-truth operational workspace where:
1. **Logistics Operators & Admins** create multimodal shipments, enforce mode-location compatibility rules, record chronological tracking milestones, manage operational exceptions (`CUSTOMS_HOLD`, `WEATHER_DELAY`, `PORT_CONGESTION`, `DAMAGED`, `MISROUTED`, `DOCUMENTATION_ISSUE`), and monitor corridor performance.
2. **Customers** log in to track their own shipments in real time, inspect deterministic ETA vs. baseline arrival breakdowns, view route progress on OpenStreetMap, and receive instant alerts on status changes or delays—strictly isolated from viewing or modifying other customers' cargo.

### Non-Negotiable Scope Guardrails (Brief Slide 4)
- **No Fake AIS / Flight Radar / Physical GPS**: Positions originate strictly from operator-entered or seeded tracking milestones (`tracking_events`).
- **Deterministic ETA & Delay Logic (No AI/ML Prediction)**: Delay hours and severity (`LOW: 0–6h`, `MEDIUM: >6–24h`, `HIGH: >24h`) are computed deterministically by `EtaService` against a configurable group delay threshold (default `12h`).
- **Out-of-Scope Sidebar Items Excluded**: In accordance with the project brief, non-brief items from the layout reference screenshot (*Payments, Billing, Messages, Smart routes, Danger zones, Bug Reports*) are intentionally excluded.

---

## 2. Group Configuration Table

| Parameter | Configured Value | Where It Lives |
| :--- | :--- | :--- |
| **Group Name** | `Group A — Multimodal Corridor Team` | `src/data/seedCargoTrace.ts` / `.env.example` (`CARGOTRACE_GROUP`) |
| **Primary Route Focus** | `Southeast Asia → Europe & East Asia` | `src/data/seedCargoTrace.ts` / **Preferences → Setting** UI |
| **Delay Threshold Base** | `12 hours` (configurable live without code changes) | `INITIAL_GROUP_CONFIG.delayThresholdHours` & **Setting** page |
| **Main Exception Focus** | `CUSTOMS_HOLD` & `PORT_CONGESTION` | `src/types/cargotrace.ts` (`ExceptionType`) |
| **Group KPI** | `On-Time Delivery Rate (%)` | Top-left KPI Card on **Overview** Dashboard |
| **Multimodal Data Model** | **Option A** (Single-mode per shipment with mode-location & carrier validation) | `docs/DESIGN_DECISIONS.md` & `ShipmentService` |

---

## 3. Tech Stack & Architecture

- **Frontend & Interactive Runtime**: React 19, TypeScript, Tailwind CSS v4 (`#DBF2FC` Ice Blue, `#072D59` Deep Navy, `#FD6E88` Coral Rose palette)
- **Interactive Mapping**: **Leaflet.js** (`leaflet`) + **OpenStreetMap** tiles with custom SVG mode markers (Ship, Plane, Truck), hub pins, and straight-segment route polylines
- **Analytics Visualization**: **Chart.js** (`chart.js` + `react-chartjs-2`) for daily multimodal shipment volume, status distribution, and carrier breakdown
- **External Public APIs**:
  - **Open-Meteo API** (`https://api.open-meteo.com/v1/forecast`): Keyless destination hub weather telemetry with 3-second timeout and deterministic fallback
  - **OpenStreetMap Nominatim API** (`https://nominatim.openstreetmap.org`): Coordinate verification and reverse geocoding for ports, airports, and depots
- **Service Layer Architecture (`src/services/CargoTraceService.ts`)**:
  - `EtaService`: Deterministic delay hours, severity (`LOW`/`MEDIUM`/`HIGH`), and group threshold evaluation
  - `ShipmentService`: State machine transitions (`CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED`) and Multimodal Option A validation
  - `TrackingService`: Append-only timeline enforcement, chronological timestamp check, and mode-specific event vocabulary validation
  - `AuthPolicyService`: Server-grade RBAC (`401`/`403`) and strict customer ownership isolation

---

## 4. Login Credentials for Lecturer / Evaluator (`ADMIN`, `OPERATOR`, `CUSTOMER`)

Authentication is handled via the dedicated **Sign In Page** (`/login`). To inspect Role-Based Access Control (RBAC) and customer data isolation, sign in using any of the following registered accounts ( click **Sign out** in the top bar or sidebar to switch roles):

| Role | Email Address | Password | Name & Organization | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@cargotrace.id` | `password123` | **Rendra Wijaya** — CargoTrace HQ Admin | Full platform access: all shipments, carriers/locations master data, threshold settings, and system audit trail |
| **`OPERATOR`** | `budisiregar@cargotrace.id` | `password123` | **Budiono Siregar** — CargoTrace Operations Desk | Operational access: create shipments, append tracking milestones, and resolve customs/weather exceptions |
| **`OPERATOR`** | `siti.ops@cargotrace.id` | `password123` | **Siti Rahmawati** — CargoTrace Operations Desk | Operational access: Sea & Air corridor dispatch and exception management |
| **`CUSTOMER`** | `ayu@nusantararetail.co.id` | `password123` | **Ayu Lestari** — PT Nusantara Retail | Read-only customer portal scoped strictly to **PT Nusantara Retail** shipments (`user_id = 3`) |
| **`CUSTOMER`** | `h.vanderberg@eurotech-bv.nl` | `password123` | **Hendrik Van Der Berg** — EuroTech Industrial B.V. | Read-only customer portal scoped strictly to **EuroTech Industrial B.V.** shipments (`user_id = 4`) |
| **`CUSTOMER`** | `bambang@indoagro-export.co.id` | `password123` | **Bambang Hartono** — PT IndoAgro Commodities | Read-only customer portal scoped strictly to **PT IndoAgro Commodities** shipments (`user_id = 5`) |

---

## 5. Setup & Running Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Copy environment configuration**:
   ```bash
   cp .env.example .env
   ```
3. **Start the development server (Port 3000)**:
   ```bash
   npm run dev
   ```
4. **Run automated unit & feature tests (`node:test`)**:
   ```bash
   npx --yes tsx --test src/services/cargotrace.test.ts
   ```
5. **Production build & TypeScript verification**:
   ```bash
   npm run build
   npm run lint
   ```

---

## 6. Project Documentation & Deliverables (Brief Slide 18)

- **[`docs/DESIGN_SPEC.md`](docs/DESIGN_SPEC.md)**: Visual hierarchy, layout mapping to the `Yuke.inc` reference screenshot, and `#DBF2FC` / `#072D59` / `#FD6E88` color tokens.
- **[`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md)**: Justification for Multimodal Option A, carrier/location compatibility matrix, and mode event vocabularies.
- **[`docs/ERD.md`](docs/ERD.md)**: Mermaid Entity-Relationship Diagram and full Data Dictionary for all 10 tables.
- **[`docs/CODE_OWNERSHIP.md`](docs/CODE_OWNERSHIP.md)**: Service layer walkthrough, live requirement modification playbook, and lecturer Q&A guide.
- **[`docs/CargoTrace.postman_collection.json`](docs/CargoTrace.postman_collection.json)**: Importable Postman v2.1 collection covering Auth, Shipments, Tracking, Carriers, Locations, and Exceptions APIs.

---

## 7. Known Limitations

1. **Straight-Segment Route Polylines**: Route lines on the OpenStreetMap canvas connect origin, intermediate tracking event coordinates, and destination hubs using straight geodesic segments rather than maritime shipping-lane bathymetry or turn-by-turn highway routing (per Brief Slide 4).
2. **Contextual Weather Telemetry**: Open-Meteo weather data reflects current meteorological conditions at the destination hub coordinates for situational awareness; it does not automatically alter shipment ETAs.

---

## 8. Credits & Library Attributions (Brief Slides 18 & 20)

- **UI Layout Inspiration**: Adapted from the provided *Yuke.inc Logistics Overview* dashboard reference image (`179387780822_image.png`).
- **Map Engine & Tiles**: [Leaflet.js](https://leafletjs.com/) (BSD-2-Clause License) with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
- **Geocoding API**: [OpenStreetMap Nominatim](https://nominatim.org/) public geocoding API.
- **Weather Telemetry API**: [Open-Meteo](https://open-meteo.com/) free non-commercial weather forecast API (CC BY 4.0).
- **Charts**: [Chart.js](https://www.chartjs.org/) & `react-chartjs-2` (MIT License).
- **Icons**: [Lucide Icons](https://lucide.dev/) (`lucide-react`, ISC License).
- **Typography**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) & [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts (OFL).
