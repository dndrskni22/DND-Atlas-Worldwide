<?php

namespace App\Http\Controllers;

use App\Models\Carrier;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\ShipmentException;
use App\Services\EtaService;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DashboardController
{
    public function __construct(
        protected EtaService $etaService
    ) {}

    /**
     * Render the main DND Atlas Worldwide (CargoTrace) Blade workspace (Brief Slide 10 & Slide 14).
     * Hydrates the initial database snapshot from MySQL Eloquent and mounts the Vite frontend bundle.
     */
    public function index(Request $request): View
    {
        return view('cargotrace.app', [
            'appName' => config('app.name', 'DND Atlas Worldwide'),
            'groupConfig' => [
                'group_name' => config('cargotrace.group_name', 'Group A'),
                'primary_route_corridor' => config('cargotrace.primary_route_corridor', 'Southeast Asia → Europe'),
                'delay_threshold_hours' => (int) config('cargotrace.delay_threshold_hours', 12),
                'main_exception_focus' => config('cargotrace.main_exception_focus', 'CUSTOMS_HOLD'),
                'primary_kpi' => config('cargotrace.primary_kpi', 'On-Time Delivery Rate'),
            ],
            'counts' => [
                'shipments' => Shipment::count(),
                'carriers' => Carrier::count(),
                'locations' => Location::count(),
                'open_exceptions' => ShipmentException::where('status', '!=', 'RESOLVED')->count(),
            ],
        ]);
    }
}
