<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes (Laravel 12 Blade + Vite Entry Point)
|--------------------------------------------------------------------------
*/

Route::get('/{any?}', [DashboardController::class, 'index'])->where('any', '^(?!api).*$');
