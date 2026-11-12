<?php

namespace App\Http\Controllers\Api;

use App\Models\Shipment;
use App\Models\ShipmentException;
use App\Policies\ShipmentPolicy;
use App\Services\ExceptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExceptionController
{
    public function __construct(
        protected ExceptionService $exceptionService,
        protected ShipmentPolicy $shipmentPolicy
    ) {}

    /**
     * GET /api/shipments/{id}/exceptions (Brief Slide 8 & 12)
     */
    public function index(Request $request, int $id): JsonResponse
    {
        $shipment = Shipment::with('exceptions')->find($id);
        if (!$shipment) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Shipment not found.'], 404);
        }

        if (!$this->shipmentPolicy->view($request->user(), $shipment)) {
            return response()->json(['error' => 'FORBIDDEN', 'message' => 'Forbidden.'], 403);
        }

        return response()->json([
            'shipment_id' => $shipment->id,
            'data' => $shipment->exceptions,
        ], 200);
    }

    /**
     * POST /api/shipments/{id}/exceptions (Brief Slide 8 & 12)
     */
    public function store(Request $request, int $id): JsonResponse
    {
        if (!$this->shipmentPolicy->mutate($request->user())) {
            return response()->json(['error' => 'FORBIDDEN', 'message' => 'Forbidden.'], 403);
        }

        $shipment = Shipment::find($id);
        if (!$shipment) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Shipment not found.'], 404);
        }

        $validated = $request->validate([
            'exception_type' => ['required', 'in:CUSTOMS_HOLD,WEATHER_DELAY,PORT_CONGESTION,DAMAGED,MISROUTED,DOCUMENTATION_ISSUE'],
            'severity' => ['required', 'in:LOW,MEDIUM,HIGH'],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string'],
        ]);

        $exception = $this->exceptionService->openException($shipment, $validated, $request->user());

        return response()->json([
            'message' => 'Shipment exception created.',
            'data' => $exception,
        ], 201);
    }

    /**
     * PATCH /api/exceptions/{id} (Brief Slide 8 & 12)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->shipmentPolicy->mutate($request->user())) {
            return response()->json(['error' => 'FORBIDDEN', 'message' => 'Forbidden.'], 403);
        }

        $exception = ShipmentException::find($id);
        if (!$exception) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Exception not found.'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:OPEN,INVESTIGATING,RESOLVED'],
            'resolution_notes' => ['nullable', 'string'],
        ]);

        $updated = $this->exceptionService->updateException($exception, $validated, $request->user());

        return response()->json([
            'message' => 'Exception status updated.',
            'data' => $updated,
        ], 200);
    }
}
