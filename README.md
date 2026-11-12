# DND Atlas Worldwide (CargoTrace) – Global Shipment Visibility & Tracking Platform

> **Web Programming 2 Final Project (UAS)**  
> Multimodal Logistics Visibility Platform covering **Sea Freight (`SEA`)**, **Air Freight (`AIR`)**, and **Road Freight (`ROAD`)** built with **Laravel 12**, **PHP 8.3+**, **MySQL 8.0+ (Eloquent ORM)**, **Laravel Sanctum**, **Blade + Tailwind CSS + Vite**, **Leaflet.js / OpenStreetMap**, and **Chart.js**.

---

## 1. Problem Statement & Project Scope (Brief Slides 3–10)

Global logistics teams and B2B cargo owners frequently suffer from fragmented tracking across ocean vessels, air cargo flights, and overland trucking fleets. **DND Atlas Worldwide (CargoTrace)** solves this by providing a unified, single-source-of-truth operational workspace where:
1. **Logistics Operators & Admins** create multimodal shipments, enforce mode-location compatibility rules, record chronological tracking milestones, manage operational exceptions (`CUSTOMS_HOLD`, `WEATHER_DELAY`, `PORT_CONGESTION`, `DAMAGED`, `MISROUTED`, `DOCUMENTATION_ISSUE`), and monitor corridor performance.
2. **Customers** log in to track their own shipments in real time, inspect deterministic ETA vs. baseline arrival breakdowns, view route progress on OpenStreetMap, and receive instant alerts on status changes or delays—strictly isolated on the server from viewing or modifying other customers' cargo.

---

## 2. Group Configuration Table (Brief Slides 8, 20 & 23)

| Parameter | Configured Value | Where It Lives |
| :--- | :--- | :--- |
| **Group Name** | `Group A — Multimodal Corridor Team` | `config/cargotrace.php` / `.env.example` (`CARGOTRACE_GROUP`) |
| **Primary Route Focus** | `Southeast Asia → Europe & East Asia` | `config/cargotrace.php` / **Preferences → Setting** UI |
| **Delay Threshold Base** | `12 hours` (configurable live without code changes) | `config/cargotrace.php` (`delay_threshold_hours`) & **Setting** page |
| **Main Exception Focus** | `CUSTOMS_HOLD` & `PORT_CONGESTION` | `app/Services/ExceptionService.php` & `database/migrations/` |
| **Group KPI** | `On-Time Delivery Rate (%)` | Top-left KPI Card on **Overview** Dashboard |
| **Multimodal Data Model** | **Option A** (Single-mode per shipment with mode-location & carrier validation) | `app/Services/ShipmentService.php` & `docs/DESIGN_DECISIONS.md` |

---

## 3. Laravel 12 + MySQL 8.0 Layered Architecture (Brief Slides 11–16)

Following **Brief Slide 15 (`Browser → Routes + Middleware → Controllers → Service Layer → Models / Eloquent`)**:

```text
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── DashboardController.php            # Renders Blade view with MySQL Eloquent metrics
│   │   │   └── Api/
│   │   │       ├── AuthController.php             # POST /api/register, /api/login, /api/logout, GET /api/user
│   │   │       ├── ShipmentController.php         # CRUD /api/shipments + server-side filter & pagination
│   │   │       ├── TrackingEventController.php    # GET/POST /api/shipments/{id}/tracking
│   │   │       ├── ExceptionController.php        # GET/POST /api/shipments/{id}/exceptions, PATCH /api/exceptions/{id}
│   │   │       └── MasterDataController.php       # GET/POST /api/carriers, GET/POST/DELETE /api/locations
│   │   └── Middleware/
│   │       └── EnsureRolePermission.php           # Server-side RBAC enforcement (401 / 403)
│   ├── Models/                                    # 9 Mandatory Eloquent ORM Models (Brief Slide 11)
│   │   ├── User.php                               # HasApiTokens (Sanctum), shipments(), notifications()
│   │   ├── Carrier.php                            # shipments() hasMany
│   │   ├── Location.php                           # originShipments(), destinationShipments()
│   │   ├── Shipment.php                           # belongsTo(User, Carrier, Location), hasMany(TrackingEvent, ShipmentItem, ShipmentException)
│   │   ├── ShipmentItem.php                       # belongsTo(Shipment)
│   │   ├── TrackingEvent.php                      # Append-only chronological timeline
│   │   ├── ShipmentException.php                  # Customs hold, weather delay, port congestion
│   │   ├── Notification.php                       # In-app delay & status alerts
│   │   └── AuditLog.php                           # Immutable actor/action/entity trail
│   ├── Policies/
│   │   └── ShipmentPolicy.php                     # Enforces customer ownership isolation on server
│   └── Services/                                  # Business Logic Layer (Brief Slide 15)
│       ├── EtaService.php                         # Deterministic delay hours, LOW/MEDIUM/HIGH severity & threshold
│       ├── ShipmentService.php                    # State transitions (CREATED -> ... -> DELIVERED) & Multimodal rules
│       ├── TrackingService.php                    # Chronological append-only milestone validation & DB::transaction
│       ├── ExceptionService.php                   # Exception lifecycle (OPEN -> INVESTIGATING -> RESOLVED)
│       └── ExternalTelemetryService.php           # Laravel HTTP Client (Open-Meteo Weather & OSM Nominatim)
├── config/
│   ├── database.php                               # MySQL 8.0 InnoDB utf8mb4 connection config
│   └── cargotrace.php                             # Group A threshold & telemetry config
├── database/
│   ├── migrations/
│   │   └── 2026_11_01_000001_create_cargotrace_tables.php  # All 10 MySQL tables with foreign keys & indexes
│   ├── seeders/
│   │   └── DatabaseSeeder.php                     # Seeds users, carriers, locations, 46 shipments, timeline, exceptions
│   └── mysql_schema_and_seed.sql                  # Ready-to-import MySQL 8.0 SQL DDL + seed dump for VPS
├── resources/views/cargotrace/
│   └── app.blade.php                              # Laravel Blade entry point mounting the Vite UI bundle
├── routes/
│   ├── api.php                                    # Sanctum-protected REST API routes (Brief Slide 12)
│   └── web.php                                    # Web route serving DashboardController@index
└── tests/Feature/
    └── CargoTraceApiTest.php                      # PHPUnit feature tests (Auth, RBAC, Lifecycle, ETA rules)
```

---

## 4. Login Credentials for Lecturer / Evaluator (`ADMIN`, `OPERATOR`, `CUSTOMER`)

Authentication is handled via the dedicated **Sign In Page**. To inspect Role-Based Access Control (RBAC) and customer data isolation, sign in using any of the following registered accounts (click **Sign out** in the top bar or sidebar to switch roles):

| Role | Email Address | Password | Name & Organization | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@cargotrace.id` | `password123` | **Rendra Wijaya** — CargoTrace HQ Admin | Full platform access: all shipments, carriers/locations master data, threshold settings, and system audit trail |
| **`OPERATOR`** | `budisiregar@cargotrace.id` | `password123` | **Budiono Siregar** — CargoTrace Operations Desk | Operational access: create shipments, append tracking milestones, and resolve customs/weather exceptions |
| **`OPERATOR`** | `siti.ops@cargotrace.id` | `password123` | **Siti Rahmawati** — CargoTrace Operations Desk | Operational access: Sea & Air corridor dispatch and exception management |
| **`CUSTOMER`** | `ayu@nusantararetail.co.id` | `password123` | **Ayu Lestari** — PT Nusantara Retail | Read-only customer portal scoped strictly to **PT Nusantara Retail** shipments (`user_id = 4`) |
| **`CUSTOMER`** | `h.vanderberg@eurotech-bv.nl` | `password123` | **Hendrik Van Der Berg** — EuroTech Industrial B.V. | Read-only customer portal scoped strictly to **EuroTech Industrial B.V.** shipments (`user_id = 5`) |
| **`CUSTOMER`** | `bambang@indoagro-export.co.id` | `password123` | **Bambang Hartono** — PT IndoAgro Commodities | Read-only customer portal scoped strictly to **PT IndoAgro Commodities** shipments (`user_id = 6`) |

---

## 5. VPS Setup & MySQL 8.0 Deployment Instructions

### Option A: Native Laravel 12 + MySQL 8.0 on Ubuntu VPS
1. **Create the MySQL 8.0 database and import schema + seed data**:
   ```bash
   mysql -u root -p -e "CREATE DATABASE cargotrace_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p cargotrace_db < database/mysql_schema_and_seed.sql
   ```
2. **Configure `.env` with your MySQL credentials**:
   ```bash
   cp .env.example .env
   # Edit DB_HOST=127.0.0.1, DB_DATABASE=cargotrace_db, DB_USERNAME=..., DB_PASSWORD=...
   ```
3. **Install Composer & Node dependencies, run migrations/seeders, and build Vite assets**:
   ```bash
   composer install --optimize-autoloader
   php artisan key:generate
   php artisan migrate --seed
   npm install && npm run build
   ```
4. **Start the server**:
   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   # Or run the unified full-stack server on port 3000:
   npm run start
   ```

### Option B: 1-Command Docker Compose on VPS (MySQL 8.0 + App)
```bash
cp .env.example .env
docker compose up -d --build
```
This automatically provisions a `mysql:8.0` container, imports `database/mysql_schema_and_seed.sql`, and starts the application on port `3000`.

---

## 6. Running Automated Tests (Brief Slide 16 & Slide 22)

- **Laravel PHPUnit Feature Tests (`tests/Feature/CargoTraceApiTest.php`)**:
  ```bash
  php artisan test --filter=CargoTraceApiTest
  ```
- **Service Layer & HTTP Contract Automated Tests**:
  ```bash
  npx --yes tsx --test src/services/cargotrace.test.ts
  ```

---

## 7. Project Documentation & Deliverables (Brief Slide 18)

- **[`docs/DESIGN_SPEC.md`](docs/DESIGN_SPEC.md)**: Visual hierarchy, layout specification, and `#DBF2FC` / `#072D59` / `#FD6E88` color tokens.
- **[`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md)**: Justification for Multimodal Option A, carrier/location compatibility matrix, and mode event vocabularies.
- **[`docs/ERD.md`](docs/ERD.md)**: Mermaid Entity-Relationship Diagram and full Data Dictionary for all 10 MySQL tables.
- **[`docs/CODE_OWNERSHIP.md`](docs/CODE_OWNERSHIP.md)**: Service layer walkthrough, live requirement modification playbook, and lecturer Q&A guide.
- **[`docs/CargoTrace.postman_collection.json`](docs/CargoTrace.postman_collection.json)**: Importable Postman v2.1 collection covering Auth, Shipments, Tracking, Carriers, Locations, and Exceptions APIs.

---

## 8. Credits & Library Attributions (Brief Slides 18 & 20)

- **Framework & ORM**: [Laravel 12](https://laravel.com/) & Eloquent ORM / Laravel Sanctum (MIT License).
- **Map Engine & Tiles**: [Leaflet.js](https://leafletjs.com/) & [MapLibre GL JS](https://maplibre.org/) with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
- **Geocoding API**: [OpenStreetMap Nominatim](https://nominatim.org/) public geocoding API.
- **Weather Telemetry API**: [Open-Meteo](https://open-meteo.com/) free non-commercial weather forecast API (CC BY 4.0).
- **Charts**: [Chart.js](https://www.chartjs.org/) & `react-chartjs-2` (MIT License).
- **Icons**: [Lucide Icons](https://lucide.dev/) (`lucide-react`, ISC License).
- **Typography**: [Outfit](https://fonts.google.com/specimen/Outfit), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) & [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts (OFL).
