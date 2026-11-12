<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Shipment;
use App\Policies\ShipmentPolicy;
use App\Services\EtaService;
use App\Services\ShipmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShipmentController
{
    public function __construct(
        protected ShipmentService $shipmentService,
        protected EtaService $etaService,
        protected ShipmentPolicy $shipmentPolicy
    ) {}

    /**
     * GET /api/shipments (Brief Slide 10, 12 & 13)
     * Supports server-side filtering, sorting, pagination, and strict customer ownership isolation.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Shipment::with(['customer', 'carrier', 'originLocation', 'destinationLocation']);

        // Server-side customer isolation (Slide 5 & Slide 13)
        if ($user->isCustomer()) {
            $query->where('customer_id', $user->id);
        }

        if ($request->filled('mode') && $request->query('mode') !== 'ALL') {
            $query->where('mode', strtoupper((string) $request->query('mode')));
        }

        if ($request->filled('status') && $request->query('status') !== 'ALL') {
            $query->where('status', strtoupper((string) $request->query('status')));
        }

        if ($request->filled('carrier_id')) {
            $query->where('carrier_id', (int) $request->query('carrier_id'));
        }

        if ($request->filled('search')) {
            $q = trim((string) $request->query('search'));
            $query->where(function ($sub) use ($q) {
                $sub->where('shipment_number', 'like', "%{$q}%")
                    ->orWhere('route_code', 'like', "%{$q}%")
                    ->orWhere('cargo_type', 'like', "%{$q}%")
                    ->orWhere('vehicle_ref', 'like', "%{$q}%");
            });
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $paginator = $query->orderBy('expected_arrival', 'desc')->paginate($perPage);

        $items = collect($paginator->items())->map(function (Shipment $sh) {
            $arr = $sh->toArray();
            $arr['eta_evaluation'] = $this->etaService->evaluate($sh->expected_arrival, $sh->estimated_arrival);
            return $arr;
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'total_pages' => $paginator->lastPage(),
            ],
        ], 200);
    }

    /**
     * POST /api/shipments (Brief Slide 12 & 13)
     */
    public function store(Request $request): JsonResponse
    {
        if (!$this->shipmentPolicy->mutate($request->user())) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => 'Customers are not permitted to create shipments.',
            ], 403);
        }

        $validated = $request->validate([
            'shipment_number' => ['nullable', 'string', 'max:32', 'unique:shipments,shipment_number'],
            'route_code' => ['required', 'string', 'max:24'],
            'customer_id' => ['required', 'integer', 'exists:users,id'],
            'carrier_id' => ['required', 'integer', 'exists:carriers,id'],
            'mode' => ['required', 'in:SEA,AIR,ROAD'],
            'vehicle_ref' => ['required', 'string', 'max:120'],
            'origin_location_id' => ['required', 'integer', 'exists:locations,id'],
            'destination_location_id' => ['required', 'integer', 'exists:locations,id'],
            'cargo_type' => ['required', 'string', 'max:180'],
            'total_weight_kg' => ['required', 'numeric', 'gt:0'],
            'total_volume_cbm' => ['required', 'numeric', 'gt:0'],
            'expected_departure' => ['required', 'date'],
            'expected_arrival' => ['required', 'date', 'after:expected_departure'],
            'estimated_arrival' => ['nullable', 'date'],
        ]);

        $validated['shipment_number'] = $validated['shipment_number'] ?? sprintf('DND-2026-%06d', Shipment::max('id') + 101);
        $validated['estimated_arrival'] = $validated['estimated_arrival'] ?? $validated['expected_arrival'];

        $shipment = $this->shipmentService->createShipment($validated, $request->user());

        return response()->json([
            'message' => 'Shipment created successfully.',
            'data' => $shipment,
        ], 201);
    }

    /**
     * GET /api/shipments/{id} (Brief Slide 12 & 13)
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $shipment = Shipment::with(['customer', 'carrier', 'originLocation', 'destinationLocation', 'items', 'trackingEvents', 'exceptions'])
            ->where('id', $id)
            ->orWhere('shipment_number', $id)
            ->first();

        if (!$shipment) {
            return response()->json([
                'error' => 'NOT_FOUND',
                'message' => "Shipment {$id} not found.",
            ], 404);
        }

        if (!$this->shipmentPolicy->view($request->user(), $shipment)) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => 'You do not have permission to view another customer\'s shipment.',
            ], 403);
        }

        return response()->json([
            'data' => array_merge($shipment->toArray(), [
                'eta_evaluation' => $this->etaService->evaluate($shipment->expected_arrival, $shipment->estimated_arrival),
            ]),
        ], 200);
    }

    /**
     * PUT/PATCH /api/shipments/{id} (Brief Slide 6 & 12)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->shipmentPolicy->mutate($request->user())) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => 'Only Admin and Logistics Operators can update shipments.',
            ], 403);
        }

        $shipment = Shipment::find($id);
        if (!$shipment) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Shipment not found.'], 404);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'in:CREATED,BOOKED,PICKED_UP,IN_TRANSIT,DELIVERED'],
            'estimated_arrival' => ['nullable', 'date'],
            'vehicle_ref' => ['nullable', 'string', 'max:120'],
            'cargo_type' => ['nullable', 'string', 'max:180'],
        ]);

        if (!empty($validated['status']) && $validated['status'] !== $shipment->status) {
            $this->shipmentService->validateTransition($shipment->status, $validated['status']);
        }

        $shipment->update(array_filter($validated, fn ($v) => !is_null($v)));

        return response()->json([
            'message' => 'Shipment updated successfully.',
            'data' => $shipment->fresh(),
        ], 200);
    }

    /**
     * DELETE /api/shipments/{id} (Brief Slide 12 & 13)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->shipmentPolicy->delete($request->user())) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => 'Only Administrators are permitted to delete shipments.',
            ], 403);
        }

        $shipment = Shipment::find($id);
        if (!$shipment) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Shipment not found.'], 404);
        }

        $number = $shipment->shipment_number;
        $shipment->delete();

        AuditLog::create([
            'actor_user_id' => $request->user()->id,
            'action' => 'SHIPMENT_DELETED',
            'entity_type' => 'Shipment',
            'entity_id' => $number,
            'summary' => "Deleted shipment {$number}.",
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => "Shipment {$number} deleted.",
        ], 200);
    }
}
