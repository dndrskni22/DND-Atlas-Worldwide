<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Unique Group Scenario Configuration (Brief Slide 8, 20 & 23)
    |--------------------------------------------------------------------------
    */
    'group_name' => env('CARGOTRACE_GROUP', 'Group A'),
    'primary_route_corridor' => env('CARGOTRACE_PRIMARY_ROUTE', 'Southeast Asia -> Europe'),
    'delay_threshold_hours' => (int) env('CARGOTRACE_DELAY_THRESHOLD_HOURS', 12),
    'main_exception_focus' => env('CARGOTRACE_MAIN_EXCEPTION_FOCUS', 'CUSTOMS_HOLD'),
    'primary_kpi' => env('CARGOTRACE_GROUP_KPI', 'On-Time Delivery Rate'),
    'multimodal_option' => env('CARGOTRACE_MULTIMODAL_MODEL', 'Option A'),

    /*
    |--------------------------------------------------------------------------
    | External Telemetry HTTP Client Settings (Brief Slide 9 & 15)
    |--------------------------------------------------------------------------
    */
    'open_meteo_url' => env('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com/v1/forecast'),
    'nominatim_url' => env('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
    'http_timeout_seconds' => (int) env('HTTP_CLIENT_TIMEOUT_SECONDS', 4),
];
