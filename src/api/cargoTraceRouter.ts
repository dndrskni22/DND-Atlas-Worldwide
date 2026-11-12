import express, { Request, Response, NextFunction } from 'express';
import {
  SEED_USERS,
  SEED_CARRIERS,
  SEED_LOCATIONS,
  SEED_SHIPMENTS,
  SEED_SHIPMENT_ITEMS,
  SEED_TRACKING_EVENTS,
  SEED_EXCEPTIONS,
  SEED_NOTIFICATIONS,
  SEED_AUDIT_LOGS,
  INITIAL_GROUP_SETTINGS,
} from '../data/seedCargoTrace';
import {
  AuthPolicyService,
  EtaService,
  ShipmentService,
  TrackingService,
} from '../services/CargoTraceService';
import {
  Carrier,
  ExceptionStatus,
  ExceptionType,
  Location,
  LocationType,
  ModeEventType,
  SeverityLevel,
  Shipment,
  ShipmentException,
  ShipmentStatus,
  TrackingEvent,
  TransportMode,
  User,
  UserRole,
} from '../types/cargotrace';

/**
 * Stateful in-memory repository initialized from realistic seed data (Brief Slide 12 & 13).
 * Exported as a factory so automated tests can spin up isolated API instances.
 */
export function createCargoTraceApiRouter() {
  const router = express.Router();
  router.use(express.json());

  const users: User[] = structuredClone(SEED_USERS);
  const carriers: Carrier[] = structuredClone(SEED_CARRIERS);
  const locations: Location[] = structuredClone(SEED_LOCATIONS);
  const shipments: Shipment[] = structuredClone(SEED_SHIPMENTS);
  const shipmentItems = structuredClone(SEED_SHIPMENT_ITEMS);
  const trackingEvents: TrackingEvent[] = structuredClone(SEED_TRACKING_EVENTS);
  const exceptions: ShipmentException[] = structuredClone(SEED_EXCEPTIONS);
  const notifications = structuredClone(SEED_NOTIFICATIONS);
  const auditLogs = structuredClone(SEED_AUDIT_LOGS);
  const settings = structuredClone(INITIAL_GROUP_SETTINGS);

  // Token store mapping Bearer token -> user_id (Sanctum-style personal access token)
  const tokens = new Map<string, number>([
    ['demo-token-admin', 1],
    ['demo-token-operator', 2],
    ['demo-token-operator-2', 3],
    ['demo-token-customer-4', 4],
    ['demo-token-customer-5', 5],
    ['demo-token-customer-6', 6],
  ]);

  function getAuthUser(req: Request): User | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const rawToken = authHeader.slice('Bearer '.length).trim();
    const userId = tokens.get(rawToken);
    if (!userId) return null;
    return users.find((u) => u.id === userId) || null;
  }

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthenticated',
        message: 'Valid Bearer token is required to access this endpoint.',
      });
      return;
    }
    (req as Request & { user?: User }).user = user;
    next();
  }

  // =========================================================================
  // 1. AUTHENTICATION ENDPOINTS (Brief Slide 12)
  // =========================================================================

  router.post('/register', (req: Request, res: Response) => {
    const { name, email, password, company_name } = req.body || {};
    if (!name || !email || !password || String(password).length < 4) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Name, valid email, and password (min 4 chars) are required.',
      });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Email address is already registered.',
      });
      return;
    }
    const newUser: User = {
      id: users.length + 1,
      name: String(name).trim(),
      email: normalizedEmail,
      role: UserRole.CUSTOMER,
      company_name: company_name ? String(company_name).trim() : 'Registered Cargo Customer',
      avatar_initials: String(name)
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    };
    users.push(newUser);
    const token = `ct-pat-${newUser.id}-${Date.now()}`;
    tokens.set(token, newUser.id);
    res.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: newUser,
    });
  });

  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Both email and password are required.',
      });
      return;
    }
    const found = users.find(
      (u) => u.email.toLowerCase() === String(email).trim().toLowerCase()
    );
    if (!found || String(password).length < 4) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Invalid email or password.',
      });
      return;
    }
    const token = `ct-pat-${found.id}-${Date.now()}`;
    tokens.set(token, found.id);
    res.status(200).json({
      message: 'Authenticated successfully.',
      token,
      user: found,
    });
  });

  router.post('/logout', requireAuth, (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const rawToken = authHeader.slice('Bearer '.length).trim();
    tokens.delete(rawToken);
    res.status(200).json({ message: 'Logged out and token revoked.' });
  });

  router.get('/user', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    res.status(200).json({ data: user });
  });

  // =========================================================================
  // 2. SHIPMENTS ENDPOINTS (Brief Slide 12 & 13)
  // =========================================================================

  router.get('/shipments', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    let scoped =
      user.role === UserRole.CUSTOMER
        ? shipments.filter((s) => s.customer_id === user.id)
        : [...shipments];

    const { mode, status, q, delayed } = req.query;
    if (mode && typeof mode === 'string' && mode !== 'ALL') {
      scoped = scoped.filter((s) => s.mode === mode.toUpperCase());
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      scoped = scoped.filter((s) => s.status === status.toUpperCase());
    }
    if (delayed === 'true' || delayed === '1') {
      scoped = scoped.filter(
        (s) =>
          s.status !== ShipmentStatus.DELIVERED &&
          EtaService.evaluate(s.expected_arrival, s.estimated_arrival, settings).is_delayed
      );
    }
    if (q && typeof q === 'string' && q.trim() !== '') {
      const query = q.trim().toLowerCase().replace(/^ct-2026-/, 'dnd-2026-');
      scoped = scoped.filter(
        (s) =>
          s.shipment_number.toLowerCase().includes(query) ||
          s.customer_name.toLowerCase().includes(query) ||
          s.cargo_type.toLowerCase().includes(query) ||
          s.vehicle_ref.toLowerCase().includes(query)
      );
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(50, Math.max(1, Number(req.query.per_page) || 10));
    const total = scoped.length;
    const data = scoped.slice((page - 1) * perPage, page * perPage).map((sh) => ({
      ...sh,
      eta_evaluation: EtaService.evaluate(sh.expected_arrival, sh.estimated_arrival, settings),
    }));

    res.status(200).json({
      data,
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    });
  });

  router.post('/shipments', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canMutateShipment(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message, errors: perm.errors });
      return;
    }

    const {
      customer_id,
      carrier_id,
      mode,
      vehicle_ref,
      origin_location_id,
      destination_location_id,
      cargo_type,
      total_weight_kg,
      total_volume_cbm,
      expected_departure,
      expected_arrival,
    } = req.body || {};

    const carrier = carriers.find((c) => c.id === Number(carrier_id));
    const origin = locations.find((l) => l.id === Number(origin_location_id));
    const destination = locations.find((l) => l.id === Number(destination_location_id));
    const customer = users.find((u) => u.id === Number(customer_id));

    if (!customer || !mode) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Valid customer_id and mode are required.',
      });
      return;
    }

    const depIso = expected_departure || new Date().toISOString();
    const arrIso =
      expected_arrival || new Date(Date.now() + 72 * 3600_000).toISOString();

    const validation = ShipmentService.validateShipmentPayload({
      mode: mode as TransportMode,
      carrier,
      origin,
      destination,
      cargo_type: String(cargo_type || ''),
      total_weight_kg: Number(total_weight_kg) || 0,
      total_volume_cbm: Number(total_volume_cbm) || 0,
      expected_departure: depIso,
      expected_arrival: arrIso,
    });

    if (!validation.valid || !carrier || !origin || !destination) {
      res.status(422).json({
        error: 'Validation Error',
        message: validation.message,
        errors: validation.errors,
      });
      return;
    }

    const newShipment: Shipment = {
      id: shipments.length + 1,
      shipment_number: `DND-2026-000${900 + shipments.length + 1}`,
      route_code: `RT-0${200 + shipments.length + 1}`,
      customer_id: customer.id,
      customer_name: customer.company_name,
      carrier_id: carrier.id,
      mode: mode as TransportMode,
      vehicle_ref: vehicle_ref || `${carrier.code}-101`,
      origin_location_id: origin.id,
      destination_location_id: destination.id,
      cargo_type: String(cargo_type),
      total_weight_kg: Number(total_weight_kg),
      total_volume_cbm: Number(total_volume_cbm),
      expected_departure: depIso,
      expected_arrival: arrIso,
      estimated_arrival: arrIso,
      actual_arrival: null,
      status: ShipmentStatus.CREATED,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    shipments.unshift(newShipment);
    res.status(201).json({ data: newShipment });
  });

  router.get('/shipments/:id', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const shipment = shipments.find(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (!shipment) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }

    const perm = AuthPolicyService.canViewShipment(user, shipment);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }

    const events = trackingEvents
      .filter((e) => e.shipment_id === shipment.id)
      .sort(
        (a, b) =>
          new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
      );
    const items = shipmentItems.filter((i) => i.shipment_id === shipment.id);
    const shExceptions = exceptions.filter((ex) => ex.shipment_id === shipment.id);

    res.status(200).json({
      data: {
        ...shipment,
        eta_evaluation: EtaService.evaluate(
          shipment.expected_arrival,
          shipment.estimated_arrival,
          settings
        ),
        items,
        tracking_events: events,
        exceptions: shExceptions,
      },
    });
  });

  const updateShipmentHandler = (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canMutateShipment(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }

    const shipment = shipments.find(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (!shipment) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }

    const { status, estimated_arrival, vehicle_ref } = req.body || {};
    if (status && status !== shipment.status) {
      const transition = ShipmentService.validateStatusTransition(
        shipment.status,
        status as ShipmentStatus
      );
      if (!transition.valid) {
        res.status(transition.status_code).json({
          error: 'Invalid Status Transition',
          message: transition.message,
          errors: transition.errors,
        });
        return;
      }
      shipment.status = status as ShipmentStatus;
      if (shipment.status === ShipmentStatus.DELIVERED) {
        shipment.actual_arrival = new Date().toISOString();
      }
    }

    if (estimated_arrival) {
      shipment.estimated_arrival = String(estimated_arrival);
    }
    if (vehicle_ref) {
      shipment.vehicle_ref = String(vehicle_ref);
    }
    shipment.updated_at = new Date().toISOString();

    res.status(200).json({
      data: {
        ...shipment,
        eta_evaluation: EtaService.evaluate(
          shipment.expected_arrival,
          shipment.estimated_arrival,
          settings
        ),
      },
    });
  };

  router.put('/shipments/:id', requireAuth, updateShipmentHandler);
  router.patch('/shipments/:id', requireAuth, updateShipmentHandler);

  router.delete('/shipments/:id', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canManageMasterDataOrSettings(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }

    const idx = shipments.findIndex(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }
    const [removed] = shipments.splice(idx, 1);
    res.status(200).json({ message: 'Shipment deleted.', data: removed });
  });

  // =========================================================================
  // 3. TRACKING TIMELINE ENDPOINTS (Brief Slide 7 & 12)
  // =========================================================================

  router.get('/shipments/:id/tracking', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const shipment = shipments.find(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (!shipment) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }
    const perm = AuthPolicyService.canViewShipment(user, shipment);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }

    const events = trackingEvents
      .filter((e) => e.shipment_id === shipment.id)
      .sort(
        (a, b) =>
          new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
      );

    res.status(200).json({ data: events });
  });

  router.post('/shipments/:id/tracking', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canMutateShipment(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }

    const shipment = shipments.find(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (!shipment) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }

    const {
      event_type,
      event_code,
      status_after,
      resulting_status,
      event_timestamp,
      occurred_at,
      location_name,
      latitude,
      longitude,
      description,
      revised_eta,
    } = req.body || {};

    const resolvedEventType = (event_type || event_code || 'LOCATION_UPDATE') as ModeEventType;
    const resolvedStatusAfter = ((status_after || resulting_status) as ShipmentStatus | undefined) || null;
    const resolvedTimestamp = String(
      event_timestamp || occurred_at || new Date().toISOString()
    );

    const existingEvents = trackingEvents.filter((e) => e.shipment_id === shipment.id);

    const validation = TrackingService.validateNewEvent({
      shipment,
      existingEvents,
      event_type: resolvedEventType,
      status_after: resolvedStatusAfter,
      event_timestamp: resolvedTimestamp,
      description: String(description || ''),
    });

    if (!validation.valid) {
      res.status(validation.status_code).json({
        error: 'Validation Error',
        message: validation.message,
        errors: validation.errors,
      });
      return;
    }

    const createdEvent: TrackingEvent = {
      id: trackingEvents.length + 1,
      shipment_id: shipment.id,
      event_type: resolvedEventType,
      status_after: resolvedStatusAfter,
      event_timestamp: resolvedTimestamp,
      location_id: null,
      location_name: String(location_name || 'Transit Checkpoint'),
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      description: String(description),
      is_exception: false,
      created_by_user_id: user.id,
      created_by_name: user.name,
    };

    trackingEvents.push(createdEvent);
    if (resolvedStatusAfter) {
      shipment.status = resolvedStatusAfter;
    }
    if (revised_eta) {
      shipment.estimated_arrival = String(revised_eta);
    }
    shipment.updated_at = new Date().toISOString();

    res.status(201).json({ data: createdEvent, shipment });
  });

  // =========================================================================
  // 4. CARRIERS, LOCATIONS & EXCEPTIONS ENDPOINTS (Brief Slide 8 & 12)
  // =========================================================================

  router.get('/carriers', requireAuth, (_req: Request, res: Response) => {
    res.status(200).json({ data: carriers });
  });

  router.post('/carriers', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canManageMasterDataOrSettings(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    const { code, name, mode, contact_email, fleet_summary } = req.body || {};
    if (!code || !name || !mode) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Carrier code, name, and operating mode (SEA/AIR/ROAD) are required.',
      });
      return;
    }
    const created: Carrier = {
      id: carriers.length + 1,
      code: String(code).toUpperCase(),
      name: String(name),
      mode: mode as TransportMode,
      contact_email: contact_email || `ops@${String(code).toLowerCase()}.example`,
      fleet_summary: fleet_summary || 'Dedicated Multimodal Fleet',
      active: true,
    };
    carriers.push(created);
    res.status(201).json({ data: created });
  });

  router.get('/locations', requireAuth, (_req: Request, res: Response) => {
    res.status(200).json({ data: locations });
  });

  router.post('/locations', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canManageMasterDataOrSettings(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    const { code, name, city, country, type, latitude, longitude } = req.body || {};
    if (!code || !name || !city || !type) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Location code, name, city, and facility type (SEAPORT/AIRPORT/DEPOT) are required.',
      });
      return;
    }
    const created: Location = {
      id: locations.length + 1,
      code: String(code).toUpperCase(),
      name: String(name),
      city: String(city),
      country: String(country || 'Indonesia'),
      type: type as LocationType,
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
    };
    locations.push(created);
    res.status(201).json({ data: created });
  });

  router.delete('/locations/:id', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canManageMasterDataOrSettings(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    const idx = locations.findIndex(
      (l) => l.id === Number(req.params.id) || l.code.toLowerCase() === String(req.params.id).toLowerCase()
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Not Found', message: 'Location not found.' });
      return;
    }
    const [removed] = locations.splice(idx, 1);
    res.status(200).json({ message: 'Location deleted successfully.', data: removed });
  });

  router.get('/shipments/:id/exceptions', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const shipment = shipments.find(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (!shipment) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }
    const perm = AuthPolicyService.canViewShipment(user, shipment);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    res.status(200).json({
      data: exceptions.filter((ex) => ex.shipment_id === shipment.id),
    });
  });

  router.post('/shipments/:id/exceptions', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canMutateShipment(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    const shipment = shipments.find(
      (s) => s.id === Number(req.params.id) || s.shipment_number === req.params.id
    );
    if (!shipment) {
      res.status(404).json({ error: 'Not Found', message: 'Shipment not found.' });
      return;
    }
    const { exception_type, severity, title, description } = req.body || {};
    if (!exception_type || !title || !description) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'exception_type, title, and description are required.',
      });
      return;
    }
    const created: ShipmentException = {
      id: exceptions.length + 1,
      shipment_id: shipment.id,
      shipment_number: shipment.shipment_number,
      exception_type: exception_type as ExceptionType,
      severity: (severity as SeverityLevel) || SeverityLevel.MEDIUM,
      status: ExceptionStatus.OPEN,
      title: String(title),
      description: String(description),
      detected_at: new Date().toISOString(),
      resolved_at: null,
      resolution_notes: null,
      reported_by_user_id: user.id,
      reported_by_name: user.name,
    };
    exceptions.unshift(created);
    res.status(201).json({ data: created });
  });

  router.patch('/exceptions/:id', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canMutateShipment(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    const ex = exceptions.find((item) => item.id === Number(req.params.id));
    if (!ex) {
      res.status(404).json({ error: 'Not Found', message: 'Exception not found.' });
      return;
    }
    const { status, resolution_notes } = req.body || {};
    if (status) {
      ex.status = status as ExceptionStatus;
      if (ex.status === ExceptionStatus.RESOLVED) {
        ex.resolved_at = new Date().toISOString();
      }
    }
    if (resolution_notes) {
      ex.resolution_notes = String(resolution_notes);
    }
    res.status(200).json({ data: ex });
  });

  router.get('/notifications', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const scoped =
      user.role === UserRole.CUSTOMER
        ? notifications.filter((n) => n.user_id === user.id)
        : notifications;
    res.status(200).json({ data: scoped });
  });

  router.get('/audit-logs', requireAuth, (req: Request, res: Response) => {
    const user = (req as Request & { user: User }).user;
    const perm = AuthPolicyService.canManageMasterDataOrSettings(user);
    if (!perm.valid) {
      res.status(perm.status_code).json({ error: 'Forbidden', message: perm.message });
      return;
    }
    res.status(200).json({ data: auditLogs });
  });

  // Downloadable MySQL 8.0 Schema & Seed SQL dump for VPS deployment (Brief Slide 11 & 14)
  router.get('/database/sql-dump', (_req: Request, res: Response) => {
    const sqlPath = `${process.cwd()}/database/mysql_schema_and_seed.sql`;
    res.download(sqlPath, 'cargotrace_mysql_schema_and_seed.sql');
  });

  return router;
}
