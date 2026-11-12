<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Shipment;
use App\Models\TrackingEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TrackingService
{
    /**
     * Mode-specific tracking event vocabulary.
     */
    public const MODE_EVENT_VOCABULARY = [
        'SEA' => ['VESSEL_LOADED', 'PORT_DEPARTED', 'TRANSSHIPMENT_ARRIVED', 'PORT_ARRIVED', 'CUSTOMS_RELEASED', 'DELIVERED_POD'],
        'AIR' => ['CARGO_ACCEPTED', 'FLIGHT_DEPARTED', 'TRANSIT_HUB_LANDED', 'FLIGHT_LANDED', 'AIR_CUSTOMS_CLEARED', 'DELIVERED_POD'],
        'ROAD' => ['DISPATCHED_DEPOT', 'DEPARTED_DEPOT', 'CHECKPOINT_ARRIVED', 'HIGHWAY_TRANSIT', 'ARRIVED_DESTINATION_HUB', 'DELIVERED_POD'],
    ];

    public function __construct(
        protected ShipmentService $shipmentService
    ) {}

    /**
     * Append a new historical tracking event without overwriting existing events (Brief Slide 7 & 15).
     */
    public function appendTrackingEvent(Shipment $shipment, array $payload, User $actor): TrackingEvent
    {
        $allowedEvents = self::MODE_EVENT_VOCABULARY[$shipment->mode] ?? [];
        if (!in_array($payload['event_code'], $allowedEvents, true)) {
            throw ValidationException::withMessages([
                'event_code' => ["Event code {$payload['event_code']} is not valid for {$shipment->mode} transport mode."],
            ]);
        }

        $latestEvent = $shipment->trackingEvents()->reorder('occurred_at', 'desc')->first();
        if ($latestEvent && Carbon::parse($payload['occurred_at'])->lt(Carbon::parse($latestEvent->occurred_at))) {
            throw ValidationException::withMessages([
                'occurred_at' => ["Tracking event timestamp cannot precede latest milestone ({$latestEvent->occurred_at})."],
            ]);
        }

        if (!empty($payload['resulting_status']) && $payload['resulting_status'] !== $shipment->status) {
            $this->shipmentService->validateTransition($shipment->status, $payload['resulting_status']);
        }

        return DB::transaction(function () use ($shipment, $payload, $actor) {
            $targetStatus = $payload['resulting_status'] ?? $shipment->status;

            $event = TrackingEvent::create([
                'shipment_id' => $shipment->id,
                'event_code' => $payload['event_code'],
                'resulting_status' => $targetStatus,
                'occurred_at' => $payload['occurred_at'],
                'location_id' => $payload['location_id'] ?? null,
                'location_name' => $payload['location_name'],
                'latitude' => $payload['latitude'],
                'longitude' => $payload['longitude'],
                'description' => $payload['description'],
                'is_exception' => (bool) ($payload['is_exception'] ?? false),
                'recorded_by_user_id' => $actor->id,
            ]);

            if ($targetStatus !== $shipment->status) {
                $oldStatus = $shipment->status;
                $shipment->update([
                    'status' => $targetStatus,
                    'actual_arrival' => $targetStatus === 'DELIVERED' ? $payload['occurred_at'] : $shipment->actual_arrival,
                ]);

                Notification::create([
                    'user_id' => $shipment->customer_id,
                    'shipment_id' => $shipment->id,
                    'shipment_number' => $shipment->shipment_number,
                    'title' => "{$shipment->shipment_number} Status Updated to {$targetStatus}",
                    'message' => $payload['description'],
                    'type' => 'STATUS_UPDATE',
                    'is_read' => false,
                    'created_at' => now(),
                ]);

                AuditLog::create([
                    'actor_user_id' => $actor->id,
                    'action' => 'STATUS_TRANSITION',
                    'entity_type' => 'Shipment',
                    'entity_id' => $shipment->shipment_number,
                    'summary' => "Transitioned {$shipment->shipment_number} from {$oldStatus} to {$targetStatus} via {$payload['event_code']}.",
                    'created_at' => now(),
                ]);
            }

            return $event;
        });
    }
}
