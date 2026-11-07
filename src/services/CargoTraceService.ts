// CargoTrace Service Layer – Pure Business Logic (Decoupled from UI & Controllers)
// Reference: CargoTrace_UAS_Final_Project_Brief_2.pdf (Slides 5, 6, 7, 8, 13, 15, 16)

import {
  Carrier,
  EtaEvaluationResult,
  GroupConfigSettings,
  Location,
  LocationType,
  ModeEventType,
  SeverityLevel,
  Shipment,
  ShipmentStatus,
  TrackingEvent,
  TransportMode,
  User,
  UserRole,
} from '../types/cargotrace';

/**
 * WHY: Explicit state machine transition map (Slide 6).
 * Prevents arbitrary status jumps (e.g. CREATED -> DELIVERED) and locks
 * terminal status DELIVERED from reverting to earlier states.
 */
export const VALID_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.BOOKED],
  [ShipmentStatus.BOOKED]: [ShipmentStatus.PICKED_UP],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [], // Terminal status
};

/**
 * WHY: Config-driven mode-aware tracking event vocabulary.
 * Ensures an AIR shipment never records LOADED_ON_VESSEL, etc.
 */
export const MODE_EVENT_VOCABULARY: Record<TransportMode, ModeEventType[]> = {
  [TransportMode.SEA]: [
    'BOOKING_CONFIRMED',
    'LOADED_ON_VESSEL',
    'DEPARTED_PORT',
    'ARRIVED_PORT',
    'DISCHARGED',
    'STATUS_CHANGE',
    'LOCATION_UPDATE',
    'EXCEPTION_REPORTED',
    'EXCEPTION_RESOLVED',
  ],
  [TransportMode.AIR]: [
    'ACCEPTED_AT_ORIGIN',
    'DEPARTED_AIRPORT',
    'ARRIVED_AIRPORT',
    'CLEARED_FOR_PICKUP',
    'STATUS_CHANGE',
    'LOCATION_UPDATE',
    'EXCEPTION_REPORTED',
    'EXCEPTION_RESOLVED',
  ],
  [TransportMode.ROAD]: [
    'PICKED_UP_FROM_SHIPPER',
    'DEPARTED_DEPOT',
    'ARRIVED_DEPOT',
    'OUT_FOR_DELIVERY',
    'STATUS_CHANGE',
    'LOCATION_UPDATE',
    'EXCEPTION_REPORTED',
    'EXCEPTION_RESOLVED',
  ],
};

export interface ServiceValidationResult {
  valid: boolean;
  status_code: 200 | 201 | 401 | 403 | 404 | 422;
  errors: Record<string, string[]>;
  message: string;
}

/**
 * EtaService (Slide 8)
 * Deterministic, unit-testable delay calculation and severity classification.
 * Never hardcodes thresholds: reads from GroupConfigSettings so the lecturer
 * can ask to change the delay threshold live during the interview (e.g. 12h -> 18h).
 */
export class EtaService {
  static evaluate(
    expectedArrivalIso: string,
    estimatedArrivalIso: string,
    settings: GroupConfigSettings
  ): EtaEvaluationResult {
    const expectedMs = new Date(expectedArrivalIso).getTime();
    const estimatedMs = new Date(estimatedArrivalIso).getTime();
    const diffMs = estimatedMs - expectedMs;

    if (diffMs <= 0 || Number.isNaN(diffMs)) {
      return {
        is_delayed: false,
        exceeds_group_threshold: false,
        delay_hours: 0,
        delay_minutes: 0,
        severity: SeverityLevel.NONE,
        expected_arrival: expectedArrivalIso,
        estimated_arrival: estimatedArrivalIso,
        group_threshold_hours: settings.delay_threshold_hours,
        reason: `On schedule (ETA is within expected arrival window; group threshold: ${settings.delay_threshold_hours}h).`,
      };
    }

    const totalMinutes = Math.round(diffMs / 60000);
    const delayHours = Number((diffMs / 3600000).toFixed(1));
    const exceedsGroupThreshold = delayHours >= settings.delay_threshold_hours;

    // WHY: Slide 8 severity rules: 0–6h LOW; >6–24h MEDIUM; >24h HIGH
    let severity: SeverityLevel = SeverityLevel.LOW;
    if (delayHours > settings.medium_severity_max_hours) {
      severity = SeverityLevel.HIGH;
    } else if (delayHours > settings.low_severity_max_hours) {
      severity = SeverityLevel.MEDIUM;
    }

    const groupLabel = settings.group_name.toLowerCase().startsWith('group')
      ? settings.group_name
      : `Group ${settings.group_name}`;

    const severityLabel =
      severity === SeverityLevel.HIGH
        ? 'High'
        : severity === SeverityLevel.MEDIUM
        ? 'Medium'
        : 'Low';

    const thresholdNote = exceedsGroupThreshold
      ? `Exceeds ${groupLabel} alert threshold of ${settings.delay_threshold_hours}h`
      : `Within ${groupLabel} alert threshold of ${settings.delay_threshold_hours}h`;

    return {
      is_delayed: true,
      exceeds_group_threshold: exceedsGroupThreshold,
      delay_hours: delayHours,
      delay_minutes: totalMinutes,
      severity,
      expected_arrival: expectedArrivalIso,
      estimated_arrival: estimatedArrivalIso,
      group_threshold_hours: settings.delay_threshold_hours,
      reason: `Delayed by +${delayHours}h (${severityLabel} impact). ${thresholdNote}.`,
    };
  }
}

export function formatEnumLabel(raw: string): string {
  const dictionary: Record<string, string> = {
    CREATED: 'Created',
    BOOKED: 'Booked',
    PICKED_UP: 'Picked Up',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    CUSTOMS_HOLD: 'Customs Hold',
    WEATHER_DELAY: 'Weather Delay',
    PORT_CONGESTION: 'Port Congestion',
    DAMAGED: 'Damaged Cargo',
    MISROUTED: 'Misrouted Cargo',
    DOCUMENTATION_ISSUE: 'Documentation Issue',
    OPEN: 'Open',
    INVESTIGATING: 'Investigating',
    RESOLVED: 'Resolved',
    BOOKING_CONFIRMED: 'Booking Confirmed',
    LOADED_ON_VESSEL: 'Loaded on Vessel',
    DEPARTED_PORT: 'Departed Port',
    ARRIVED_PORT: 'Arrived at Port',
    DISCHARGED: 'Container Discharged',
    ACCEPTED_AT_ORIGIN: 'Accepted at Air Terminal',
    DEPARTED_AIRPORT: 'Departed Airport',
    ARRIVED_AIRPORT: 'Arrived at Airport',
    CLEARED_FOR_PICKUP: 'Cleared for Pickup',
    PICKED_UP_FROM_SHIPPER: 'Picked Up from Shipper',
    DEPARTED_DEPOT: 'Departed Road Depot',
    ARRIVED_DEPOT: 'Arrived at Road Depot',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    STATUS_CHANGE: 'Status Updated',
    LOCATION_UPDATE: 'Checkpoint Update',
    EXCEPTION_REPORTED: 'Exception Logged',
    EXCEPTION_RESOLVED: 'Exception Resolved',
    SEAPORT: 'Seaport',
    AIRPORT: 'Airport',
    DEPOT: 'Road Depot',
  };
  if (dictionary[raw]) return dictionary[raw];
  return raw
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * ShipmentService (Slides 6 & Multimodal Validation)
 * Validates status transitions, carrier-mode matching, and origin/destination compatibility.
 */
export class ShipmentService {
  static canTransitionStatus(current: ShipmentStatus, next: ShipmentStatus): boolean {
    if (current === next) return true;
    const allowed = VALID_STATUS_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  static validateStatusTransition(
    current: ShipmentStatus,
    next: ShipmentStatus
  ): ServiceValidationResult {
    if (current === ShipmentStatus.DELIVERED && next !== ShipmentStatus.DELIVERED) {
      return {
        valid: false,
        status_code: 422,
        message: 'Terminal status DELIVERED cannot return to an earlier status.',
        errors: {
          status: ['Terminal status DELIVERED cannot return to an earlier status without special administrative procedure.'],
        },
      };
    }

    if (!this.canTransitionStatus(current, next)) {
      const allowed = VALID_STATUS_TRANSITIONS[current];
      return {
        valid: false,
        status_code: 422,
        message: `Invalid status transition from ${current} to ${next}.`,
        errors: {
          status: [
            `Invalid transition: ${current} -> ${next}. Allowed next status: ${
              allowed.length ? allowed.join(', ') : 'none (terminal)'
            }.`,
          ],
        },
      };
    }

    return {
      valid: true,
      status_code: 200,
      message: 'Valid status transition.',
      errors: {},
    };
  }

  /**
   * WHY: Enforces Multimodal Option A rules:
   * - SEA requires SEAPORT origin and SEAPORT destination
   * - AIR requires AIRPORT origin and AIRPORT destination
   * - ROAD allows DEPOT, SEAPORT, or AIRPORT
   * - Carrier mode must match Shipment mode
   */
  static validateShipmentPayload(input: {
    mode: TransportMode;
    carrier: Carrier | undefined;
    origin: Location | undefined;
    destination: Location | undefined;
    cargo_type: string;
    total_weight_kg: number;
    total_volume_cbm: number;
    expected_departure: string;
    expected_arrival: string;
  }): ServiceValidationResult {
    const errors: Record<string, string[]> = {};

    if (!input.cargo_type || input.cargo_type.trim().length < 2) {
      errors.cargo_type = ['Cargo type description is required.'];
    }
    if (!input.total_weight_kg || input.total_weight_kg <= 0) {
      errors.total_weight_kg = ['Weight (kg) must be greater than zero.'];
    }
    if (!input.total_volume_cbm || input.total_volume_cbm <= 0) {
      errors.total_volume_cbm = ['Volume (CBM) must be greater than zero.'];
    }

    if (!input.carrier) {
      errors.carrier_id = ['Selected carrier does not exist.'];
    } else if (input.carrier.mode !== input.mode) {
      errors.carrier_id = [
        `Carrier mode mismatch: ${input.carrier.name} operates ${input.carrier.mode}, but shipment mode is ${input.mode}.`,
      ];
    }

    if (!input.origin) {
      errors.origin_location_id = ['Origin location is required.'];
    }
    if (!input.destination) {
      errors.destination_location_id = ['Destination location is required.'];
    }

    if (input.origin && input.destination) {
      if (input.origin.id === input.destination.id) {
        errors.destination_location_id = ['Origin and destination locations must be different.'];
      }

      if (input.mode === TransportMode.SEA) {
        if (input.origin.type !== LocationType.SEAPORT) {
          errors.origin_location_id = [
            `SEA shipment requires a SEAPORT origin (${input.origin.name} is ${input.origin.type}).`,
          ];
        }
        if (input.destination.type !== LocationType.SEAPORT) {
          errors.destination_location_id = [
            `SEA shipment requires a SEAPORT destination (${input.destination.name} is ${input.destination.type}).`,
          ];
        }
      } else if (input.mode === TransportMode.AIR) {
        if (input.origin.type !== LocationType.AIRPORT) {
          errors.origin_location_id = [
            `AIR shipment requires an AIRPORT origin (${input.origin.name} is ${input.origin.type}).`,
          ];
        }
        if (input.destination.type !== LocationType.AIRPORT) {
          errors.destination_location_id = [
            `AIR shipment requires an AIRPORT destination (${input.destination.name} is ${input.destination.type}).`,
          ];
        }
      } else if (input.mode === TransportMode.ROAD) {
        const allowedRoadTypes = [LocationType.DEPOT, LocationType.SEAPORT, LocationType.AIRPORT];
        if (!allowedRoadTypes.includes(input.origin.type)) {
          errors.origin_location_id = ['ROAD shipment requires DEPOT, SEAPORT, or AIRPORT origin.'];
        }
        if (!allowedRoadTypes.includes(input.destination.type)) {
          errors.destination_location_id = ['ROAD shipment requires DEPOT, SEAPORT, or AIRPORT destination.'];
        }
      }
    }

    const depMs = new Date(input.expected_departure).getTime();
    const arrMs = new Date(input.expected_arrival).getTime();
    if (Number.isNaN(depMs) || Number.isNaN(arrMs) || arrMs <= depMs) {
      errors.expected_arrival = ['Expected arrival must be chronologically after expected departure.'];
    }

    const hasErrors = Object.keys(errors).length > 0;
    return {
      valid: !hasErrors,
      status_code: hasErrors ? 422 : 200,
      message: hasErrors ? Object.values(errors).flat().join(' ') : 'Validation passed.',
      errors,
    };
  }
}

/**
 * TrackingService (Slide 7)
 * Validates append-only chronological tracking events and mode-specific event types.
 */
export class TrackingService {
  static validateNewEvent(input: {
    shipment: Shipment;
    existingEvents: TrackingEvent[];
    event_type: ModeEventType;
    status_after: ShipmentStatus | null;
    event_timestamp: string;
    description: string;
  }): ServiceValidationResult {
    const errors: Record<string, string[]> = {};

    const allowedVocabulary = MODE_EVENT_VOCABULARY[input.shipment.mode] || [];
    if (!allowedVocabulary.includes(input.event_type)) {
      errors.event_type = [
        `Event type ${input.event_type} is not valid for ${input.shipment.mode} transport mode.`,
      ];
    }

    if (!input.description || input.description.trim().length < 3) {
      errors.description = ['Event description is required (minimum 3 characters).'];
    }

    const newTs = new Date(input.event_timestamp).getTime();
    if (Number.isNaN(newTs)) {
      errors.event_timestamp = ['Valid event timestamp is required.'];
    } else if (input.existingEvents.length > 0) {
      const latestEvent = [...input.existingEvents].sort(
        (a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
      )[0];
      const latestTs = new Date(latestEvent.event_timestamp).getTime();
      if (newTs < latestTs) {
        errors.event_timestamp = [
          `Chronological order violation: event timestamp (${input.event_timestamp}) cannot be earlier than the latest recorded event (${latestEvent.event_timestamp}).`,
        ];
      }
    }

    if (input.status_after && input.status_after !== input.shipment.status) {
      const transitionCheck = ShipmentService.validateStatusTransition(
        input.shipment.status,
        input.status_after
      );
      if (!transitionCheck.valid) {
        errors.status_after = transitionCheck.errors.status || [transitionCheck.message];
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    return {
      valid: !hasErrors,
      status_code: hasErrors ? 422 : 201,
      message: hasErrors ? Object.values(errors).flat().join(' ') : 'Tracking event validated.',
      errors,
    };
  }
}

/**
 * AuthPolicyService (Slides 5, 13, 16)
 * Enforces Role-Based Access Control (RBAC) identically to Laravel Policies & Gates.
 */
export class AuthPolicyService {
  static canViewShipment(user: User | null, shipment: Shipment): ServiceValidationResult {
    if (!user) {
      return {
        valid: false,
        status_code: 401,
        message: 'Unauthenticated. Please log in.',
        errors: { auth: ['Unauthenticated request.'] },
      };
    }
    if (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) {
      return { valid: true, status_code: 200, message: 'Authorized.', errors: {} };
    }
    // WHY: Customer isolation (Slide 5 & 13) - Customer can ONLY view their own shipments
    if (user.role === UserRole.CUSTOMER && shipment.customer_id === user.id) {
      return { valid: true, status_code: 200, message: 'Authorized owner.', errors: {} };
    }
    return {
      valid: false,
      status_code: 403,
      message: 'Forbidden: Customers may only access their own shipments.',
      errors: { authorization: ['You do not have permission to view another customer’s shipment.'] },
    };
  }

  static canMutateShipment(user: User | null): ServiceValidationResult {
    if (!user) {
      return {
        valid: false,
        status_code: 401,
        message: 'Unauthenticated.',
        errors: { auth: ['Authentication required.'] },
      };
    }
    if (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) {
      return { valid: true, status_code: 200, message: 'Authorized.', errors: {} };
    }
    return {
      valid: false,
      status_code: 403,
      message: 'Forbidden: Only Logistics Operators and Administrators can create or modify shipments.',
      errors: { authorization: ['Customer role is read-only.'] },
    };
  }

  static canManageMasterDataOrSettings(user: User | null): ServiceValidationResult {
    if (!user) {
      return {
        valid: false,
        status_code: 401,
        message: 'Unauthenticated.',
        errors: { auth: ['Authentication required.'] },
      };
    }
    if (user.role === UserRole.ADMIN) {
      return { valid: true, status_code: 200, message: 'Authorized Admin.', errors: {} };
    }
    return {
      valid: false,
      status_code: 403,
      message: 'Forbidden: Administrator role required for master data, settings, and audit logs.',
      errors: { authorization: ['Administrator privileges required.'] },
    };
  }
}

/**
 * Haversine Great-Circle Distance Calculator (approx. km and miles)
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateHaversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(calculateHaversineKm(lat1, lon1, lat2, lon2) * 0.621371);
}
