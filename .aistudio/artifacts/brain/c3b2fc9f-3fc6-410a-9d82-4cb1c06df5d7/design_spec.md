# CargoTrace – Design Specification & Architecture Plan (Phase 0)

## Executive Summary
This design specification establishes the UI/UX architecture, component structure, color palette, and multimodal logistics logic for **CargoTrace – Global Shipment Visibility & Tracking Platform**, based on:
1. **Design Reference**: `image.png` (Logistics Overview dashboard layout, density, KPI bars, segmented controls, routes table)
2. **Project Brief**: `CargoTrace_UAS_Final_Project_Brief_2.pdf` (Slides 1–25: business rules, security, API contracts, RBAC, evaluation criteria)
3. **Palette & Libraries**:
   - Deep Navy: `#072D59`
   - Soft Ice Blue: `#DBF2FC`
   - Coral Rose Accent: `#FD6E88`
   - Map: **OpenStreetMap via Leaflet.js**
   - Charts: **Chart.js**

---

## 1. Color Palette Tokens & Hierarchy

| Role | Color Hex | Application in UI |
|------|-----------|-------------------|
| **Deep Navy (Primary)** | `#072D59` | Dominant brand elements, primary CTA buttons, page headings, active segmented tab, sidebar brand chip |
| **Soft Ice Blue (Tint)** | `#DBF2FC` | Soft card fills, secondary highlight pills, table hover states, timeline track accents |
| **Coral Rose (Accent)** | `#FD6E88` | High-priority exceptions (`CUSTOMS_HOLD`), delayed shipment badges, alert meters |
| **Canvas Background** | `#F4F7FB` | Soft cool background matching the reference screenshot |
| **Card Surface** | `#FFFFFF` | Crisp white containers with `1px border #E2E8F0` and `12px` rounded corners |
| **Body Text** | `#1E293B` | High-contrast readable body text |
| **Muted Text** | `#64748B` | Labels, metadata, timestamps, units |

### Multimodal Transport Modes:
- 🚢 **SEA**: Deep Navy badge (`#072D59` on `#DBF2FC`), Ship icon, Seaport locations only.
- ✈️ **AIR**: Sky Blue badge (`#0284C7` on `#E0F2FE`), Plane icon, Airport locations only.
- 🚚 **ROAD**: Teal badge (`#0D9488` on `#CCFBF1`), Truck icon, Depots and Ports.

---

## 2. Layout Structure (Strict Reference to `image.png`)

```
+---------------------------------------------------------------------------------------------------------+
| [CT Logo] CargoTrace Global   | [Clock] 05 Nov 2026, 11:36       [Role: Operator]   [+ New Shipment]    |
+---------------------------------------------------------------------------------------------------------+
| [SIDEBAR]                     | Logistics Overview                                                      |
| - Overview (Active)           | Track multimodal shipments, delays, exceptions, and on-time performance |
| - Tracking                    +-------------------------------------------------------------------------+
| - Shipments (My Orders)       | [KPI 1: On-Time Rate]  [KPI 2: In Transit]  [KPI 3: Delayed] [KPI 4: Holds] |
| - Active Routes (Leaflet Map) |  Progress Bar 84.2%     Progress Bar 67%     Progress Bar 9.8%  Prog Bar 4.2%   |
| - Popular Routes              |  842/1000 Shipped       327/490 Active       48 Delayed (12h)   18 Open Holds   |
| - Weather Forecast            +-------------------------------------------------------------------------+
| - Exceptions                  | [All Modes v]  [Search shipment CT-..., carrier, city...]  [24h|3d|7d]  |
| - Notifications               +-------------------------------------------------------------------------+
| - Audit Log                   | [Shipments Analytics Bar Chart (Stacked Sea / Air / Road)]              |
| ----------------------------- +-------------------------------------------------------------------------+
| Preferences:                  | Popular routes (Ranked by shipment volume)                 [Export CSV] |
| - Settings (Delay Thresh:12h) | Route | Carrier & Vehicle | Status Badge | Mode | Dist | Vol | Avg | On-Time  |
| - User Profile & Logout       +-------------------------------------------------------------------------+
+---------------------------------------------------------------------------------------------------------+
```

---

## 3. Multimodal Business Rules & Validation (Option A)
1. **Shipment Lifecycle**: `CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED`.
2. **Deterministic Delay Formula**:
   - Delay = `Estimated Arrival - Expected Arrival`
   - Threshold = `12 hours` (configurable in settings)
   - Severity: `0–6h` = LOW, `>6–24h` = MEDIUM, `>24h` = HIGH (`#FD6E88`)
3. **Location Compatibility**:
   - `SEA`: Origin and Destination must be `SEAPORT`
   - `AIR`: Origin and Destination must be `AIRPORT`
   - `ROAD`: Origin and Destination may be `DEPOT`, `SEAPORT`, or `AIRPORT`
4. **Interactive OpenStreetMap with Leaflet.js**:
   - Custom markers per mode (Ship, Plane, Truck)
   - Dynamic geodesic route polyline with live checkpoint popups
5. **Role-Based Access Control (RBAC)**:
   - **Administrator**: Full system management, settings, carrier & location registers, audit trail.
   - **Logistics Operator**: Create/update shipments, log tracking events, resolve exceptions.
   - **Customer**: Strictly scoped to own company shipments, tracking timeline, and notifications.

---

## 4. Next Step
Upon your confirmation/feedback on this Phase 0 Design Spec, we proceed immediately to **Phase 1: Architecture, Data Models, Role Setup, and Full Multimodal Shipment Visibility Implementation**!
