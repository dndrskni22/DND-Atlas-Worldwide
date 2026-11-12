<?php

namespace App\Policies;

use App\Models\Shipment;
use App\Models\User;

class ShipmentPolicy
{
    /**
     * Determine whether the user can view a specific shipment (Brief Slide 5 & Slide 13).
     * Customers can strictly ONLY view shipments where customer_id === user->id.
     */
    public function view(User $user, Shipment $shipment): bool
    {
        if ($user->isAdmin() || $user->isOperator()) {
            return true;
        }

        return $user->isCustomer() && (int) $shipment->customer_id === (int) $user->id;
    }

    /**
     * Determine whether the user can create or update shipments and tracking events.
     */
    public function mutate(User $user): bool
    {
        return $user->isAdmin() || $user->isOperator();
    }

    /**
     * Determine whether the user can delete shipments or manage master data.
     */
    public function delete(User $user): bool
    {
        return $user->isAdmin();
    }
}
