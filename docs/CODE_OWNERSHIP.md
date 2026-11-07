# CargoTrace – Code Ownership & Live Interview Guide

> **Purpose**: Prepared for the Web Programming 2 Final Project (UAS) live code-ownership defense (`CargoTrace_UAS_Final_Project_Brief_2.pdf`, Slides 2, 15, 19, 20).  
> Every team member should study this guide to explain **where** business rules live, **why** architectural decisions were made, and **how** to perform live requirement modifications during the lecturer's interview.

---

## 1. Architectural Separation (Service Layer Pattern — Slide 15)

Rather than placing validation, status state machines, or delay math inside UI event handlers or controllers, **all domain business logic is isolated in pure, deterministic Services** inside `src/services/CargoTraceService.ts` (which maps 1:1 to `app/Services/*` in Laravel 12):

| Service Class | Responsibility | Key Methods |
| :--- | :--- | :--- |
| **`EtaService`** | Deterministic comparison between `expected_arrival_at` (baseline) and `current_eta_at` (updated ETA). Classifies severity (`LOW`, `MEDIUM`, `HIGH`) and checks the group's configurable delay threshold. | `evaluateEta(expectedArrivalAt, currentEtaAt, status, groupDelayThresholdHours)` |
| **`ShipmentService`** | Enforces the forward-only status transition state machine (`CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED`), locks terminal `DELIVERED` shipments, and validates Multimodal Option A compatibility rules. | `validateStatusTransition(currentStatus, nextStatus)`<br>`validateMultimodalShipment(input)` |
| **`TrackingService`** | Enforces append-only tracking history, validates that `event_type` belongs to the shipment's transport mode vocabulary (`SEA`, `AIR`, `ROAD`), and prevents backdated timestamps earlier than the latest recorded event. | `validateNewTrackingEvent(shipment, input)` |
| **`AuthPolicyService`** | Enforces server-grade Role-Based Access Control (`ADMIN`, `OPERATOR`, `CUSTOMER`) and customer ownership isolation (`401 Unauthenticated`, `403 Forbidden`). | `authorizeViewShipment(user, shipment)`<br>`authorizeMutateShipment(user)`<br>`authorizeManageMasterData(user)` |

---

## 2. Live Modification Playbook (Lecturer Interview Scenarios)

During the UAS code-ownership defense, the lecturer may ask the team to modify a business rule live. Here is the exact 1-line location for common live requests:

### Scenario A: *"Change the group delay threshold from 12 hours to 18 hours"*
1. **Via the UI (Zero Code Change)**:
   - Navigate to **Preferences → Setting** in the left sidebar.
   - Change **Delay Threshold Base (Hours)** from `12` to `18` and click **Save Configuration**.
   - Every shipment's `exceedsGroupThreshold` flag and KPI card updates immediately.
2. **In Code / Config (`src/data/seedCargoTrace.ts` or `.env.example`)**:
   - Open `src/data/seedCargoTrace.ts` → `INITIAL_GROUP_CONFIG.delayThresholdHours = 18` (or `CARGOTRACE_DELAY_THRESHOLD_HOURS=18` in `.env`).
   - Why it works cleanly: `EtaService.evaluateEta()` never hardcodes `12`; it accepts `groupDelayThresholdHours` as a parameter.

### Scenario B: *"Change the MEDIUM delay severity band from 6–24 hours to 4–18 hours"*
- Open `src/services/CargoTraceService.ts` inside `EtaService.evaluateEta()`:
  ```ts
  // Slide 8 deterministic severity classification
  if (delayHours <= 4) { // Changed from 6 to 4
    severity = SeverityLevel.LOW;
  } else if (delayHours <= 18) { // Changed from 24 to 18
    severity = SeverityLevel.MEDIUM;
  } else {
    severity = SeverityLevel.HIGH;
  }
  ```
- Run unit tests immediately to verify: `npx --yes tsx --test src/services/cargotrace.test.ts`.

### Scenario C: *"Allow SEA shipments to originate from a DEPOT for inland container stuffing"*
- Open `src/services/CargoTraceService.ts` inside `ShipmentService.validateMultimodalShipment()`:
  - Update the `TransportMode.SEA` check to allow `[LocationType.SEAPORT, LocationType.DEPOT]` for `originLocation.type`.

---

## 3. Core Interview Questions & Model Answers

### Q1: Why can't a shipment jump directly from `CREATED` to `IN_TRANSIT` or be edited after `DELIVERED`?
**Answer**: Slide 6 defines a strict sequential lifecycle (`CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED`). In `ShipmentService.ALLOWED_STATUS_TRANSITIONS`, each status maps explicitly to its allowed next status (`CREATED: [BOOKED]`, `BOOKED: [PICKED_UP]`, etc.), and `DELIVERED: []` has an empty array. If `currentStatus === ShipmentStatus.DELIVERED`, `validateStatusTransition()` returns HTTP `422` because delivered shipments are immutable terminal records.

### Q2: How do you prevent a Customer from viewing another Customer's shipment by guessing the Shipment ID or API endpoint?
**Answer**: Hiding buttons in the UI is never sufficient (Slides 5 & 13). Every read and list query passes through `AuthPolicyService.authorizeViewShipment(user, shipment)` and `filterShipmentsForUser(user, shipments)`. If `user.role === UserRole.CUSTOMER` and `shipment.customerId !== user.id`, the service immediately returns `{ allowed: false, httpStatus: 403, reason: 'HTTP 403 Forbidden — Customers may only view their own shipments.' }`. You can test this live using the top-right **Role & Demo Account Switcher** or the **RBAC Security Tester** on the Help page.

### Q3: How does your Multimodal (SEA / AIR / ROAD) model avoid turning into three separate systems?
**Answer**: Following Option A, all shipments share a single `shipments` table and the exact same 5-stage status flow (`CREATED → BOOKED → PICKED_UP → IN_TRANSIT → DELIVERED`). Transport mode is an enum (`SEA`, `AIR`, `ROAD`) paired with two domain constraints in `ShipmentService.validateMultimodalShipment()`:
1. `carrier.mode` must equal `shipment.mode`.
2. Location types must match the mode (`SEA` uses `SEAPORT` → `SEAPORT`; `AIR` uses `AIRPORT` → `AIRPORT`; `ROAD` supports `DEPOT`, `SEAPORT`, or `AIRPORT` for first/last-mile drayage). Mode-specific milestones (such as `VESSEL_LOADED` or `FLIGHT_DEPARTED`) live in `tracking_events.event_type`.

### Q4: How is weather data used, and why isn't it predicting ETA?
**Answer**: Per Slide 4 and the project guardrails, CargoTrace does not use AI/ML ETA prediction or live GPS hardware. `ExternalApiService.fetchDestinationWeather()` queries the public Open-Meteo API for the destination hub's coordinates with a 3-second timeout and deterministic fallback. It is displayed strictly as **contextual operational metadata** so operators can see if high winds or storms exist at the destination port/airport when evaluating a manual `WEATHER_DELAY` exception.
