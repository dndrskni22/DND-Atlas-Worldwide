<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipmentItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'sku',
        'description',
        'quantity',
        'unit',
        'weight_kg',
        'volume_cbm',
        'hs_code',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'weight_kg' => 'float',
            'volume_cbm' => 'float',
        ];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class, 'shipment_id');
    }
}
