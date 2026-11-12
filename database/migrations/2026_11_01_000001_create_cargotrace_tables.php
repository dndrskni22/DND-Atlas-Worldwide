<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for all 9 mandatory CargoTrace tables + Sanctum tokens + Group Settings (Brief Slide 11).
     */
    public function up(): void
    {
        // 1. users (Brief Slide 5 & 11)
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('email', 160)->unique();
            $table->string('password');
            $table->enum('role', ['ADMIN', 'OPERATOR', 'CUSTOMER'])->default('CUSTOMER')->index();
            $table->string('company_name', 160);
            $table->string('avatar_initials', 8)->default('CT');
            $table->rememberToken();
            $table->timestamps();
        });

        // Sanctum Personal Access Tokens (Brief Slide 12)
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 2. carriers (Brief Slide 11 & Multimodal Option A)
        Schema::create('carriers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->string('name', 160);
            $table->enum('mode', ['SEA', 'AIR', 'ROAD'])->index();
            $table->string('contact_email', 160);
            $table->string('fleet_summary', 255);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // 3. locations (Brief Slide 9 & 11)
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->string('name', 180);
            $table->string('city', 120);
            $table->string('country', 120);
            $table->enum('type', ['SEAPORT', 'AIRPORT', 'DEPOT'])->index();
            $table->decimal('latitude', 10, 6);
            $table->decimal('longitude', 10, 6);
            $table->timestamps();
        });

        // 4. shipments (Brief Slide 6, 8 & 11)
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->string('shipment_number', 32)->unique();
            $table->string('route_code', 24)->index();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('carrier_id')->constrained('carriers')->restrictOnDelete();
            $table->enum('mode', ['SEA', 'AIR', 'ROAD']);
            $table->string('vehicle_ref', 120);
            $table->foreignId('origin_location_id')->constrained('locations')->restrictOnDelete();
            $table->foreignId('destination_location_id')->constrained('locations')->restrictOnDelete();
            $table->string('cargo_type', 180);
            $table->decimal('total_weight_kg', 12, 2);
            $table->decimal('total_volume_cbm', 10, 2);
            $table->dateTime('expected_departure');
            $table->dateTime('expected_arrival');
            $table->dateTime('estimated_arrival');
            $table->dateTime('actual_arrival')->nullable();
            $table->enum('status', ['CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'])->default('CREATED');
            $table->timestamps();

            $table->index(['status', 'mode'], 'shipments_status_mode_index');
            $table->index(['customer_id', 'status'], 'shipments_customer_status_index');
        });

        // 5. shipment_items (Brief Slide 11)
        Schema::create('shipment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->cascadeOnDelete();
            $table->string('sku', 64);
            $table->string('description', 255);
            $table->unsignedInteger('quantity')->default(1);
            $table->string('unit', 32);
            $table->decimal('weight_kg', 12, 2);
            $table->decimal('volume_cbm', 10, 2);
            $table->string('hs_code', 32);
            $table->timestamps();
        });

        // 6. tracking_events (Append-Only Historical Timeline - Brief Slide 7 & 11)
        Schema::create('tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->cascadeOnDelete();
            $table->string('event_code', 64);
            $table->enum('resulting_status', ['CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']);
            $table->dateTime('occurred_at');
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('location_name', 180);
            $table->decimal('latitude', 10, 6);
            $table->decimal('longitude', 10, 6);
            $table->text('description');
            $table->boolean('is_exception')->default(false);
            $table->foreignId('recorded_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['shipment_id', 'occurred_at'], 'tracking_events_shipment_chronological_idx');
        });

        // 7. shipment_exceptions (Brief Slide 8 & 11)
        Schema::create('shipment_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->cascadeOnDelete();
            $table->enum('exception_type', [
                'CUSTOMS_HOLD',
                'WEATHER_DELAY',
                'PORT_CONGESTION',
                'DAMAGED',
                'MISROUTED',
                'DOCUMENTATION_ISSUE',
            ]);
            $table->enum('severity', ['LOW', 'MEDIUM', 'HIGH']);
            $table->enum('status', ['OPEN', 'INVESTIGATING', 'RESOLVED'])->default('OPEN');
            $table->string('title', 180);
            $table->text('description');
            $table->dateTime('detected_at');
            $table->dateTime('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->foreignId('reported_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['status', 'severity'], 'exceptions_status_severity_idx');
        });

        // 8. notifications (Brief Slide 10 & 11)
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shipment_id')->nullable()->constrained('shipments')->cascadeOnDelete();
            $table->string('shipment_number', 32)->nullable();
            $table->string('title', 180);
            $table->text('message');
            $table->enum('type', ['DELAY_ALERT', 'DELAY_DETECTED', 'EXCEPTION_OPENED', 'STATUS_CHANGED', 'STATUS_UPDATE']);
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();
        });

        // 9. audit_logs (Brief Slide 10 & 11)
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 64)->index();
            $table->string('entity_type', 64);
            $table->string('entity_id', 64);
            $table->text('summary');
            $table->timestamp('created_at')->useCurrent();
        });

        // 10. group_settings (Brief Slide 8, 20 & 23)
        Schema::create('group_settings', function (Blueprint $table) {
            $table->id();
            $table->string('group_name', 64)->default('Group A');
            $table->string('primary_route_corridor', 120)->default('Southeast Asia → Europe');
            $table->unsignedInteger('delay_threshold_hours')->default(12);
            $table->string('main_exception_focus', 64)->default('CUSTOMS_HOLD');
            $table->string('primary_kpi', 64)->default('On-Time Delivery Rate');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('group_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('shipment_exceptions');
        Schema::dropIfExists('tracking_events');
        Schema::dropIfExists('shipment_items');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('carriers');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('users');
    }
};
