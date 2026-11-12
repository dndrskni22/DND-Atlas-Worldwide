<?php

namespace App\Http\Controllers\Api;

use App\Models\Carrier;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MasterDataController
{
    /**
     * GET /api/carriers (Brief Slide 12)
     */
    public function indexCarriers(): JsonResponse
    {
        return response()->json([
            'data' => Carrier::orderBy('name')->get(),
        ], 200);
    }

    /**
     * POST /api/carriers (Brief Slide 5 & 12 - Admin only)
     */
    public function storeCarrier(Request $request): JsonResponse
    {
        if (!$request->user()?->isAdmin()) {
            return response()->json(['error' => 'FORBIDDEN', 'message' => 'Only Admin can create carriers.'], 403);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:16', 'unique:carriers,code'],
            'name' => ['required', 'string', 'max:160'],
            'mode' => ['required', 'in:SEA,AIR,ROAD'],
            'contact_email' => ['nullable', 'email', 'max:160'],
            'fleet_summary' => ['required', 'string', 'max:255'],
        ]);

        $carrier = Carrier::create([
            ...$validated,
            'contact_email' => $validated['contact_email'] ?? 'ops@' . strtolower($validated['code']) . '.logistics',
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Carrier registered.',
            'data' => $carrier,
        ], 201);
    }

    /**
     * GET /api/locations (Brief Slide 12)
     */
    public function indexLocations(): JsonResponse
    {
        return response()->json([
            'data' => Location::orderBy('city')->get(),
        ], 200);
    }

    /**
     * POST /api/locations (Brief Slide 5 & 12 - Admin only)
     */
    public function storeLocation(Request $request): JsonResponse
    {
        if (!$request->user()?->isAdmin()) {
            return response()->json(['error' => 'FORBIDDEN', 'message' => 'Only Admin can create locations.'], 403);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:16', 'unique:locations,code'],
            'name' => ['required', 'string', 'max:180'],
            'city' => ['required', 'string', 'max:120'],
            'country' => ['required', 'string', 'max:120'],
            'type' => ['required', 'in:SEAPORT,AIRPORT,DEPOT'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $location = Location::create($validated);

        return response()->json([
            'message' => 'Location hub created.',
            'data' => $location,
        ], 201);
    }

    /**
     * DELETE /api/locations/{id} (Admin only - prevents deleting hubs referenced by active shipments)
     */
    public function destroyLocation(Request $request, int $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) {
            return response()->json(['error' => 'FORBIDDEN', 'message' => 'Only Admin can delete locations.'], 403);
        }

        $location = Location::find($id);
        if (!$location) {
            return response()->json(['error' => 'NOT_FOUND', 'message' => 'Location not found.'], 404);
        }

        if ($location->originShipments()->exists() || $location->destinationShipments()->exists()) {
            return response()->json([
                'error' => 'CONFLICT',
                'message' => "Cannot delete {$location->code} while referenced by active shipments.",
            ], 422);
        }

        $location->delete();

        return response()->json([
            'message' => "Location {$location->code} deleted.",
        ], 200);
    }
}
