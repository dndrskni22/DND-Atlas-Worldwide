<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Carrier;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShipmentService
{
    /**
     * Valid status transition graph (Brief Slide 6).
     * Terminal status DELIVERED cannot transition back to earlier states.
     */
    public const ALLOWED_TRANSITIONS = [
        'CREATED' => ['BOOKED'],
        'BOOKED' => ['PICKED_UP', 'IN_TRANSIT'],
        'PICKED_UP' => ['IN_TRANSIT'],
        'IN_TRANSIT' => ['DELIVERED'],
        'DELIVERED' => [],
    ];

    /**
     * Multimodal Option A: Required LocationType per TransportMode.
     */
    public const REQUIRED_HUB_TYPE_BY_MODE = [
        'SEA' => 'SEAPORT',
        'AIR' => 'AIRPORT',
        'ROAD' => 'DEPOT',
    ];

    /**
     * Validate whether a status transition is permitted.
     */
    public function validateTransition(string $currentStatus, string $nextStatus): void
    {
        if ($currentStatus === $nextStatus) {
            return;
        }

        if ($currentStatus === 'DELIVERED') {
            throw ValidationException::withMessages([
                'status' => ['Terminal status DELIVERED cannot be reverted to an earlier lifecycle stage (Brief Slide 6).'],
            ]);
        }

        $allowed = self::ALLOWED_TRANSITIONS[$currentStatus] ?? [];
        if (!in_array($nextStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Invalid status transition from {$currentStatus} to {$nextStatus}."],
            ]);
        }
    }

    /**
     * Validate Multimodal Option A compatibility between mode, carrier, origin, and destination.
     */
    public function validateMultimodalCompatibility(string $mode, Carrier $carrier, Location $origin, Location $destination): void
    {
        if ($origin->id === $destination->id) {
            throw ValidationException::withMessages([
                'destination_location_id' => ['Origin and destination hubs cannot be identical.'],
            ]);
        }

        if ($carrier->mode !== $mode) {
            throw ValidationException::withMessages([
                'carrier_id' => ["Carrier {$carrier->name} ({$carrier->mode}) does not match shipment mode {$mode}."],
            ]);
        }

        $expectedHubType = self::REQUIRED_HUB_TYPE_BY_MODE[$mode] ?? null;
        if ($origin->type !== $expectedHubType || $destination->type !== $expectedHubType) {
            throw ValidationException::withMessages([
                'mode' => ["{$mode} shipments require {$expectedHubType} hubs for both origin and destination."],
            ]);
        }
    }

    /**
     * Create a new shipment inside a database transaction with audit trail logging.
     */
    public function createShipment(array $data, User $actor): Shipment
    {
        $carrier = Carrier::findOrFail($data['carrier_id']);
        $origin = Location::findOrFail($data['origin_location_id']);
        $destination = Location::findOrFail($data['destination_location_id']);

        $this->validateMultimodalCompatibility($data['mode'], $carrier, $origin, $destination);

        return DB::transaction(function () use ($data, $actor, $origin, $destination) {
            $shipment = Shipment::create([
                ...$data,
                'status' => $data['status'] ?? 'CREATED',
            ]);

            AuditLog::create([
                'actor_user_id' => $actor->id,
                'action' => 'SHIPMENT_CREATED',
                'entity_type' => 'Shipment',
                'entity_id' => $shipment->shipment_number,
                'summary' => "Created {$shipment->mode} shipment {$shipment->shipment_number} ({$origin->code} → {$destination->code}).",
                'created_at' => now(),
            ]);

            return $shipment->load(['customer', 'carrier', 'originLocation', 'destinationLocation']);
        });
    }
}
