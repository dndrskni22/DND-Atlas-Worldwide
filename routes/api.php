<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ExceptionController;
use App\Http\Controllers\Api\MasterDataController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\TrackingEventController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| CargoTrace / DND Atlas Worldwide REST API Routes (Brief Slide 12 & 13)
|--------------------------------------------------------------------------
*/

// Public Authentication Endpoints
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected Laravel Sanctum Endpoints
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Shipments Resource
    Route::get('/shipments', [ShipmentController::class, 'index']);
    Route::post('/shipments', [ShipmentController::class, 'store']);
    Route::get('/shipments/{id}', [ShipmentController::class, 'show']);
    Route::match(['put', 'patch'], '/shipments/{id}', [ShipmentController::class, 'update']);
    Route::delete('/shipments/{id}', [ShipmentController::class, 'destroy']);

    // Chronological Tracking Events
    Route::get('/shipments/{id}/tracking', [TrackingEventController::class, 'index']);
    Route::post('/shipments/{id}/tracking', [TrackingEventController::class, 'store']);

    // Shipment Exceptions
    Route::get('/shipments/{id}/exceptions', [ExceptionController::class, 'index']);
    Route::post('/shipments/{id}/exceptions', [ExceptionController::class, 'store']);
    Route::patch('/exceptions/{id}', [ExceptionController::class, 'update']);

    // Master Data: Carriers & Locations
    Route::get('/carriers', [MasterDataController::class, 'indexCarriers']);
    Route::post('/carriers', [MasterDataController::class, 'storeCarrier']);
    Route::get('/locations', [MasterDataController::class, 'indexLocations']);
    Route::post('/locations', [MasterDataController::class, 'storeLocation']);
    Route::delete('/locations/{id}', [MasterDataController::class, 'destroyLocation']);
});
