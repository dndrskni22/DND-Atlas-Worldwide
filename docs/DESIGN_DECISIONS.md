# CargoTrace – Design Decisions & Multimodal Strategy (DESIGN_DECISIONS.md)

## 1. Group Configuration
- **Group Name**: Group A
- **Primary Route Focus**: Southeast Asia → Europe (e.g. Tanjung Priok / Singapore → Rotterdam / Hamburg, CGK → AMS)
- **Delay Threshold Base**: 12 hours (configurable via Settings/Environment, never hardcoded)
- **Main Exception Focus**: `CUSTOMS_HOLD` (with support for `WEATHER_DELAY`, `PORT_CONGESTION`, `DAMAGED`, `MISROUTED`, `DOCUMENTATION_ISSUE`)
- **Group KPI for Dashboard**: On-Time Delivery Rate (target ≥ 85%)
- **Seed Theme**:
  - Ports: Tanjung Priok (IDTPP), Tanjung Perak (IDSUB), Port of Singapore (SGSIN), Port Klang (MYPKG), Port of Rotterdam (NLRTM)
  - Airports: Soekarno-Hatta (CGK), Changi (SIN), Schiphol (AMS), Kingsford Smith (SYD)
  - Depots: Cikarang Dry Port (IDCKG), Surabaya Hub (IDSUB-DEP)
  - Carriers: Fictional multimodal operators (e.g., Pacific Wave Shipping, Nusantara Cargo Air, Trans-Java Freight Logistics)

---

## 2. Multimodal Data Model Choice: Option A (Primary Mode per Shipment)
- **Decision**: Option A (default & interview-ready).
- **Rationale**:
  - Direct 1:1 validation between shipment mode (`SEA`, `AIR`, `ROAD`) and carrier capabilities.
  - Ensures clean, explainable database schema without premature table complexity for student code-ownership defense.
  - Strict validation rules:
    - `SEA`: origin and destination must both be `SEAPORT` locations.
    - `AIR`: origin and destination must both be `AIRPORT` locations.
    - `ROAD`: origin and destination can be `DEPOT`, `SEAPORT`, or `AIRPORT`.
    - Carrier's operating mode must match the shipment mode.
    - Vehicle reference is mode-aware (e.g. MV Ever Horizon / Voy 402 for SEA, GA-Cargo Flight 882 for AIR, B 9812 UIX Heavy Rig for ROAD).

---

## 3. UI/UX Translation & Custom Color Tokens
- Derived from the user's explicit palette request:
  - Deep Navy: `#072D59` (Authority, headers, active navigation pills, primary buttons)
  - Ice Blue: `#DBF2FC` (Soft card fills, secondary highlight badges, timeline tracks)
  - Coral Rose: `#FD6E88` (Warning accents, delayed shipments, active exceptions)
- Replicating the exact component hierarchy of `image.png` (4 KPI metric cards with progress meters, search and segmented time pill, analytics bar chart, and route table with export).
