# CargoTrace – Design Specification (DESIGN_SPEC.md)
**Project**: CargoTrace – Global Multimodal Shipment Visibility & Tracking Platform  
**Target Course**: Web Programming 2 (UAS Final Project)  
**Reference Document**: `CargoTrace_UAS_Final_Project_Brief_2.pdf` (Slides 1–25)  
**Layout Reference**: `image.png` ("Logistics Overview", workspace reference)  
**Color Palette Requirement**: `#DBF2FC` (Ice Blue Tint), `#072D59` (Deep Navy), `#FD6E88` (Coral Rose Accent)

---

## 1. Design Philosophy & Aesthetic System
The interface follows the structural composition, density, and layout hierarchy of the provided reference image (`image.png`), adapted specifically for multimodal freight logistics (Sea 🚢, Air ✈️, Road 🚚).

### Strict Anti-AI Slop Rules:
- **No decorative gradients, purple/indigo glassmorphism, or blurred floating blobs.**
- **No emoji used as icons**: All icons are precise, uniform-weight thin line glyphs (Lucide).
- **No fake placeholder copy**: Real logistics terminology (UN/LOCODE codes, container TEUs, MAWB air waybills, CMR road consignment notes, AIS/GPS tracking events).
- **Data-dense scannability**: Tight typography, consistent 10–12px card radii, subtle 1px border lines, and clear visual hierarchy.

---

## 2. Color System & Palette Tokens

### Primary Custom Palette:
| Token Name | Hex Code | Purpose / Usage |
|------------|----------|-----------------|
| `primary-navy` | `#072D59` | Dominant brand color, headings, active segmented tab, sidebar brand badge |
| `ice-blue` | `#DBF2FC` | Soft background fills, highlight pill backgrounds, subtle table accents |
| `coral-rose` | `#FD6E88` | Accent alert, delayed shipments, active exceptions, high-severity badges |
| `bg-page` | `#F4F7FB` | Main application background (cool neutral gray-blue) |
| `surface-card` | `#FFFFFF` | Clean white cards, tables, drawers, and modal surfaces |
| `border-subtle` | `#E2E8F0` | 1px card outlines, table row dividers, and input borders |
| `border-accent` | `#C4E4F7` | Tinted border accent derived from `#DBF2FC` |
| `text-headline` | `#072D59` | Primary headings, KPI figures, bold titles |
| `text-body` | `#1E293B` | High-contrast readable body text (WCAG AA compliant) |
| `text-muted` | `#64748B` | Labels, subtitles, table meta details, timestamps |

### Multimodal Transport Mode Colors:
| Mode | Color | Background Tint | Icon Glyphs |
|------|-------|-----------------|-------------|
| **SEA** (Ocean Freight) | `#072D59` | `#DBF2FC` | Anchor / Cargo Ship |
| **AIR** (Air Cargo) | `#0284C7` | `#E0F2FE` | Cargo Plane |
| **ROAD** (Ground Trucking) | `#0D9488` | `#CCFBF1` | Semi Truck |

### Shipment Lifecycle Status Tokens:
| Status | Badge Background | Text / Border | Description |
|--------|------------------|---------------|-------------|
| `CREATED` | `#F1F5F9` | `#475569` | Order registered in system |
| `BOOKED` | `#DBF2FC` | `#072D59` | Slot confirmed with carrier |
| `PICKED_UP` | `#E0F2FE` | `#0284C7` | Cargo collected at origin depot/port |
| `IN_TRANSIT` | `#CCFBF1` | `#0D9488` | On sea, flight, or highway |
| `DELIVERED` | `#DCFCE7` | `#15803D` | Reached final destination & signed |
| `DELAYED` | `#FFF1F2` | `#FD6E88` | Current ETA > Expected Arrival |

### Exception Severity Tokens:
- **LOW**: `#64748B` on `#F1F5F9`
- **MEDIUM**: `#D97706` on `#FEF3C7`
- **HIGH**: `#FD6E88` on `#FFF1F2` (Custom Coral Accent)

---

## 3. Typography & Spacing Scale
- **Font Family**: Inter, Plus Jakarta Sans, system-ui
- **Page Titles**: 22px (`font-bold text-headline tracking-tight`)
- **Card Titles & Section Headers**: 15px (`font-semibold text-headline`)
- **KPI Large Metrics**: 26px (`font-bold font-mono tracking-tight text-headline`)
- **Body & Table Text**: 13px (`text-body leading-normal`)
- **Micro Labels & Subtitles**: 11px / 12px (`text-muted font-medium`)
- **Border Radii**: Cards `12px` (`rounded-xl`), Inputs/Buttons `8px` (`rounded-lg`), Status Badges `9999px` (`rounded-full`)
- **Shadows**: Softest drop-shadows `0 1px 3px rgba(7, 45, 89, 0.05)`, no heavy floating glows.

---

## 4. Component Inventory (Replicating Reference Image `image.png`)

1. **Left Navigation Sidebar**:
   - Workspace header: CargoTrace logo mark + "CargoTrace Global" + chevron
   - Main navigation:
     - 📊 **Overview** (Active filled pill in navy/ice-blue)
     - 🔍 **Tracking** (Search shipment by CT-XXXX & timeline)
     - 📦 **Shipments** ("My Orders" / full operational shipments list with filters & pagination)
     - 🗺️ **Active Routes** (Interactive OpenStreetMap Leaflet visualization)
     - 📈 **Popular Routes** (High-volume corridors & transit analytics)
     - 🌦️ **Weather Forecast** (Live port/airport weather via Open-Meteo)
     - ⚠️ **Exceptions** (Active incident resolution & customs holds)
     - 🔔 **Notifications** (In-app milestone alerts)
     - 📜 **Audit Log** (Security & compliance trail for Admin)
   - Management section (Admin): Carriers, Locations, Users
   - Preferences section: Settings (configurable delay threshold e.g. 12h), Profile, Logout
   - Fixed Bottom User Card: Avatar, user name (e.g. Budiono Siregar / Operator), role badge, overflow menu.

2. **Top Bar**:
   - Date/Time pill with clock icon: e.g. `05 Nov 2026, 11:36` (reflecting live server/system time)
   - Role indicator chip (Admin / Operator / Customer)
   - Primary Action Button: `+ New Shipment` (Navy `#072D59` with subtle hover lift) opening creation modal with mode validation.

3. **Row of 4 KPI Metric Cards**:
   - Card 1: **On-Time Delivery Rate** (Thin colored progress bar, percentage, icon, `842/1000 Shipped`, Group KPI)
   - Card 2: **In Transit Volume** (Thin progress bar, percentage, icon, `327/490 Active`)
   - Card 3: **Delayed Shipments** (Thin progress bar, percentage, icon, `48 Delayed` based on 12h threshold)
   - Card 4: **Open Exceptions** (Thin progress bar, percentage, icon, `18/420 Active Holds`)

4. **Interactive Filter Toolbar**:
   - Mode Selector: Dropdown (All Modes, Sea Freight, Air Freight, Road Freight)
   - Search Input: "Search shipment CT-..., carrier, origin, destination..."
   - Segmented Time Range: `15m` | `1h` | `24h` | `3d` | `7d` (with dark navy active pill `#072D59`)
   - Reset & Export CSV button

5. **Analytics Card**:
   - Header: "Shipments Analytics" with Peak / Avg summary badges
   - Chart: Multi-series bar chart (stacked/grouped by Sea, Air, Road) powered by Chart.js matching the exact `#072D59`, `#3AA0AB`, and `#5A8AC9` tones.

6. **Popular Routes Table Card**:
   - Subtitle: "Ranked by shipment volume · March 2026"
   - Columns: Route (Location initial badge + Origin to Destination + Route code), Carrier / Vehicle (Mode chip + Carrier name + Vessel/Flight/Truck ref), Status badge, Mode, Distance (Haversine approx in mi/km), Shipments count, Avg transit time, On-time rate.

7. **Interactive Map Modal / View**:
   - Leaflet.js with OpenStreetMap tiles
   - Mode-specific markers: ⚓ Seaport, ✈️ Airport, 🏢 Logistics Depot
   - Dynamic route polyline with vessel/flight/truck position and timeline popups.

8. **Shipment Detail Drawer & Timeline**:
   - Append-only chronological tracking events
   - Visual distinction between normal progression events and exception events (customs hold, weather delay).

---

## 5. Architectural Alignment & Constraints
- Single source of truth for business rules:
  - Valid status transition map: `CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED`.
  - Mode compatibility: SEA strictly SEAPORTs, AIR strictly AIRPORTs, ROAD DEPOTs/ports.
  - Delay threshold: Configurable integer (default `12` hours), with formula `Estimated Arrival > Expected Arrival + Threshold`.
