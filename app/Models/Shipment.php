<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_number',
        'route_code',
        'customer_id',
        'carrier_id',
        'mode',
        'vehicle_ref',
        'origin_location_id',
        'destination_location_id',
        'cargo_type',
        'total_weight_kg',
        'total_volume_cbm',
        'expected_departure',
        'expected_arrival',
        'estimated_arrival',
        'actual_arrival',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'total_weight_kg' => 'float',
            'total_volume_cbm' => 'float',
            'expected_departure' => 'datetime',
            'expected_arrival' => 'datetime',
            'estimated_arrival' => 'datetime',
            'actual_arrival' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class, 'carrier_id');
    }

    public function originLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'origin_location_id');
    }

    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'destination_location_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ShipmentItem::class, 'shipment_id');
    }

    public function trackingEvents(): HasMany
    {
        return $this->hasMany(TrackingEvent::class, 'shipment_id')->orderBy('occurred_at', 'asc');
    }

    public function exceptions(): HasMany
    {
        return $this->hasMany(ShipmentException::class, 'shipment_id')->orderBy('detected_at', 'desc');
    }
}
