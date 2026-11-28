<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Active & Multi-Group Scenario Configurations (Brief Slide 8, 20 & 23)
    |--------------------------------------------------------------------------
    */
    'group_name' => env('CARGOTRACE_GROUP', 'Group A–C Multi-Scenario'),
    'primary_route_corridor' => env('CARGOTRACE_PRIMARY_ROUTE', 'Southeast Asia -> Europe / North America / Australia'),
    'delay_threshold_hours' => (int) env('CARGOTRACE_DELAY_THRESHOLD_HOURS', 12),
    'main_exception_focus' => env('CARGOTRACE_MAIN_EXCEPTION_FOCUS', 'CUSTOMS_HOLD'),
    'primary_kpi' => env('CARGOTRACE_GROUP_KPI', 'On-Time Delivery Rate'),
    'multimodal_option' => env('CARGOTRACE_MULTIMODAL_MODEL', 'Option A'),

    'groups' => [
        'GROUP_A' => [
            'name' => 'Group A',
            'route' => 'Southeast Asia -> Europe',
            'delay_threshold_hours' => 12,
            'main_exception' => 'CUSTOMS_HOLD',
            'kpi' => 'On-Time Delivery Rate',
        ],
        'GROUP_B' => [
            'name' => 'Group B',
            'route' => 'Asia -> North America',
            'delay_threshold_hours' => 18,
            'main_exception' => 'WEATHER_DELAY',
            'kpi' => 'Average Delay Duration',
        ],
        'GROUP_C' => [
            'name' => 'Group C',
            'route' => 'Southeast Asia -> Australia',
            'delay_threshold_hours' => 24,
            'main_exception' => 'DOCUMENTATION_ISSUE',
            'kpi' => 'Exception Resolution Time',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | External Telemetry HTTP Client Settings (Brief Slide 9 & 15)
    |--------------------------------------------------------------------------
    */
    'open_meteo_url' => env('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com/v1/forecast'),
    'nominatim_url' => env('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
    'http_timeout_seconds' => (int) env('HTTP_CLIENT_TIMEOUT_SECONDS', 4),
];

