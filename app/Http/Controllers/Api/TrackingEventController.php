<?php

namespace App\Http\Controllers\Api;

use App\Models\Shipment;
use App\Policies\ShipmentPolicy;
use App\Services\TrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrackingEventController
{
    public function __construct(
        protected TrackingService $trackingService,
        protected ShipmentPolicy $shipmentPolicy
    ) {}

    /**
     * GET /api/shipments/{id}/tracking (Brief Slide 7 & 12)
     */
    public function index(Request $request, int $id): JsonResponse
    {
        $shipment = Shipment::with('trackingEvents')->find($id);
        if (!$shipment) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Shipment not found.'], 404);
        }

        if (!$this->shipmentPolicy->view($request->user(), $shipment)) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => 'You are not authorized to view tracking events for this shipment.',
            ], 403);
        }

        return response()->json([
            'shipment_id' => $shipment->id,
            'shipment_number' => $shipment->shipment_number,
            'current_status' => $shipment->status,
            'data' => $shipment->trackingEvents,
        ], 200);
    }

    /**
     * POST /api/shipments/{id}/tracking (Brief Slide 7 & 12)
     */
    public function store(Request $request, int $id): JsonResponse
    {
        if (!$this->shipmentPolicy->mutate($request->user())) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => 'Customers cannot append tracking events.',
            ], 403);
        }

        $shipment = Shipment::find($id);
        if (!$shipment) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Shipment not found.'], 404);
        }

        $validated = $request->validate([
            'event_code' => ['required', 'string', 'max:64'],
            'resulting_status' => ['nullable', 'in:CREATED,BOOKED,PICKED_UP,IN_TRANSIT,DELIVERED'],
            'occurred_at' => ['required', 'date'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'location_name' => ['required', 'string', 'max:180'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'description' => ['required', 'string'],
            'is_exception' => ['nullable', 'boolean'],
        ]);

        $event = $this->trackingService->appendTrackingEvent($shipment, $validated, $request->user());

        return response()->json([
            'message' => 'Tracking event appended to chronological timeline.',
            'data' => $event,
            'shipment_status' => $shipment->fresh()->status,
        ], 201);
    }
}
