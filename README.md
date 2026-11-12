# DND Atlas Worldwide (CargoTrace)

Global multimodal shipment visibility and tracking platform. Built for the
UAS Web Programming 2 final project (Group A) at Universitas Malikussaleh.

The backend is Laravel 12 with MySQL 8 and Sanctum. The dashboard is a
React 19 + Vite + Tailwind app served through a Blade shell. Shipments move
by sea, air, and road, with deterministic ETA evaluation, delay detection,
exception management, and live destination weather.

## Group A configuration

| Setting | Value |
| --- | --- |
| Primary route corridor | Southeast Asia to Europe |
| Delay threshold | 12 hours |
| Main exception focus | CUSTOMS_HOLD |
| Primary KPI | On-Time Delivery Rate |
| Multimodal model | Option A (one primary mode per shipment) |

Delay severity follows the threshold: 0 to 6 hours is LOW, over 6 to 24 hours
is MEDIUM, over 24 hours is HIGH. A shipment that reaches DELIVERED can never
move back to an earlier status.

## Tech stack

- Laravel 12 (PHP 8.3), Eloquent ORM, Sanctum personal access tokens
- MySQL 8, migrations plus a seeder loaded from the canonical seed dataset
- React 19, Vite, Tailwind CSS, MapLibre GL and Leaflet with OpenStreetMap
- Open-Meteo for destination weather, Nominatim for geocoding
- PHPUnit for the API, tsx node:test for the TypeScript service layer

## Setup

Requirements: PHP 8.3 with pdo_mysql, Composer, Node 20, MySQL 8.

```bash
cp .env.example .env
composer install
php artisan key:generate
npm install
npm run build
php artisan migrate --seed
php artisan serve --host=0.0.0.0 --port=3100
```

The seeder loads `database/seeders/data/seed.json`, exported from the
TypeScript seed dataset (`src/data/seedCargoTrace.ts`) with
`npm run seed:dump`. It creates 6 users, 7 carriers, 14 locations,
46 shipments, 47 items, 156 tracking events, 6 exceptions, 4 notifications,
and 7 audit log entries.

## Demo accounts

Every seed account uses the password `password123`.

| Email | Role |
| --- | --- |
| admin@cargotrace.id | ADMIN (Rendra Wijaya) |
| budisiregar@cargotrace.id | OPERATOR |
| siti.ops@cargotrace.id | OPERATOR |
| ayu@nusantararetail.co.id | CUSTOMER (PT Nusantara Retail) |
| h.vanderberg@eurotech-bv.nl | CUSTOMER (EuroTech Industrial B.V.) |
| bambang@indoagro-export.co.id | CUSTOMER (PT IndoAgro Commodities) |

## API

Base URL: `/api`. Auth is Bearer token from `POST /api/login`.

| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | /api/register | Create an account, returns a token |
| POST | /api/login | Returns a Sanctum token |
| POST | /api/logout | Revokes the current token |
| GET | /api/user | Current user |
| GET, POST | /api/shipments | List (search, filter, paginate) and create |
| GET, PUT, PATCH, DELETE | /api/shipments/{id} | Show, update, delete |
| GET, POST | /api/shipments/{id}/tracking | Tracking timeline |
| GET, POST | /api/shipments/{id}/exceptions | Exceptions for a shipment |
| PATCH | /api/exceptions/{id} | Update an exception |
| GET, POST | /api/carriers | Master data |
| GET, POST, DELETE | /api/locations | Master data |

Customers only see their own shipments. Admins and operators see all of them.
A Postman collection is in `docs/CargoTrace.postman_collection.json`.

## Tests

```bash
php artisan test        # API feature tests, sqlite in-memory
npm test                # TypeScript service and router tests (tsx --test)
```

## Deployment

The live demo runs on a VPS behind Apache on port 80, proxied to the
Laravel server on port 3100 (`dnd-atlas.service`, `php artisan serve`).
Live link: http://43.173.52.180/

## Known limitations

- The React dashboard currently renders the bundled seed dataset. The
  Laravel API serves the same data from MySQL, and moving the dashboard to
  live API reads is in progress.
- The demo runs over plain HTTP, so browsers may show a "not secure" notice.
- No email notifications yet.

## Documentation

- `docs/ERD.md` — entity relationship diagram and data dictionary
- `docs/DESIGN_SPEC.md` — design specification
- `docs/DESIGN_DECISIONS.md` — design decisions
- `docs/CODE_OWNERSHIP.md` — who owns which module
- `public/assets/aistudio/CargoTrace_UAS_Final_Project_Brief_2_6f0af89f.pdf` — the project brief
