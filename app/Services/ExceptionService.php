<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Shipment;
use App\Models\ShipmentException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ExceptionService
{
    /**
     * Open a new shipment exception and notify the customer (Brief Slide 8 & 15).
     */
    public function openException(Shipment $shipment, array $data, User $actor): ShipmentException
    {
        return DB::transaction(function () use ($shipment, $data, $actor) {
            $exception = ShipmentException::create([
                'shipment_id' => $shipment->id,
                'exception_type' => $data['exception_type'],
                'severity' => $data['severity'],
                'status' => $data['status'] ?? 'OPEN',
                'title' => $data['title'],
                'description' => $data['description'],
                'detected_at' => $data['detected_at'] ?? now(),
                'reported_by_user_id' => $actor->id,
            ]);

            Notification::create([
                'user_id' => $shipment->customer_id,
                'shipment_id' => $shipment->id,
                'shipment_number' => $shipment->shipment_number,
                'title' => "Exception Flagged: {$exception->title}",
                'message' => "{$exception->exception_type} ({$exception->severity}) reported on {$shipment->shipment_number}.",
                'type' => 'EXCEPTION_OPENED',
                'is_read' => false,
                'created_at' => now(),
            ]);

            AuditLog::create([
                'actor_user_id' => $actor->id,
                'action' => 'EXCEPTION_OPENED',
                'entity_type' => 'ShipmentException',
                'entity_id' => $shipment->shipment_number,
                'summary' => "Opened {$exception->severity} {$exception->exception_type} on {$shipment->shipment_number}: {$exception->title}",
                'created_at' => now(),
            ]);

            return $exception;
        });
    }

    /**
     * Update or resolve an existing shipment exception (Brief Slide 8 & 12).
     */
    public function updateException(ShipmentException $exception, array $data, User $actor): ShipmentException
    {
        return DB::transaction(function () use ($exception, $data, $actor) {
            $newStatus = $data['status'] ?? $exception->status;
            $exception->update([
                'status' => $newStatus,
                'resolution_notes' => $data['resolution_notes'] ?? $exception->resolution_notes,
                'resolved_at' => $newStatus === 'RESOLVED' ? now() : $exception->resolved_at,
            ]);

            AuditLog::create([
                'actor_user_id' => $actor->id,
                'action' => $newStatus === 'RESOLVED' ? 'EXCEPTION_RESOLVED' : 'EXCEPTION_UPDATED',
                'entity_type' => 'ShipmentException',
                'entity_id' => $exception->shipment->shipment_number ?? (string) $exception->shipment_id,
                'summary' => "Updated exception #{$exception->id} ({$exception->exception_type}) to {$newStatus}.",
                'created_at' => now(),
            ]);

            return $exception->fresh();
        });
    }
}
