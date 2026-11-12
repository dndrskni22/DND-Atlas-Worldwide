<?php

namespace Tests\Feature;

use App\Models\Shipment;
use App\Models\User;
use App\Services\EtaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CargoTraceApiTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    /**
     * 1. Authentication: Valid login returns 200 + Sanctum token; invalid login returns 401; unauthenticated returns 401 (Brief Slide 16).
     */
    public function test_authentication_valid_invalid_and_unauthenticated_access(): void
    {
        $unauth = $this->getJson('/api/shipments');
        $unauth->assertStatus(401);

        $badLogin = $this->postJson('/api/login', [
            'email' => 'admin@cargotrace.id',
            'password' => 'wrong-password',
        ]);
        $badLogin->assertStatus(401);

        $goodLogin = $this->postJson('/api/login', [
            'email' => 'admin@cargotrace.id',
            'password' => 'password123',
        ]);
        $goodLogin->assertStatus(200)
            ->assertJsonStructure(['access_token', 'token_type', 'user']);
    }

    /**
     * 2. Authorization & Customer Isolation: Customer can ONLY view their own shipments and receives 403 on another customer's shipment or POST /api/shipments (Brief Slide 13 & 16).
     */
    public function test_customer_cannot_view_other_customers_shipment_or_create_shipment(): void
    {
        $customerAyu = User::where('email', 'ayu@nusantararetail.co.id')->firstOrFail();
        $otherShipment = Shipment::where('customer_id', '!=', $customerAyu->id)->firstOrFail();

        $forbiddenShow = $this->actingAs($customerAyu, 'sanctum')
            ->getJson("/api/shipments/{$otherShipment->id}");
        $forbiddenShow->assertStatus(403);

        $forbiddenCreate = $this->actingAs($customerAyu, 'sanctum')
            ->postJson('/api/shipments', [
                'route_code' => 'RT-0142',
                'customer_id' => $customerAyu->id,
                'carrier_id' => 1,
                'mode' => 'SEA',
                'vehicle_ref' => 'MV Test',
                'origin_location_id' => 1,
                'destination_location_id' => 4,
                'cargo_type' => 'Test Cargo',
                'total_weight_kg' => 1000,
                'total_volume_cbm' => 10,
                'expected_departure' => '2026-11-01 08:00:00',
                'expected_arrival' => '2026-11-15 08:00:00',
            ]);
        $forbiddenCreate->assertStatus(403);
    }

    /**
     * 3. Shipment Lifecycle & Invalid Status Transition: DELIVERED cannot revert to IN_TRANSIT (Brief Slide 6 & 16).
     */
    public function test_delivered_shipment_cannot_revert_to_earlier_status(): void
    {
        $operator = User::where('role', 'OPERATOR')->firstOrFail();
        $deliveredShipment = Shipment::where('status', 'DELIVERED')->firstOrFail();

        $response = $this->actingAs($operator, 'sanctum')
            ->patchJson("/api/shipments/{$deliveredShipment->id}", [
                'status' => 'IN_TRANSIT',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    /**
     * 4. Deterministic ETA & Delay Rule Evaluation: 0–6h LOW, >6–24h MEDIUM, >24h HIGH, and configurable threshold (Brief Slide 8 & 16).
     */
    public function test_deterministic_eta_delay_and_severity_rules(): void
    {
        $etaService = new EtaService();

        $onTime = $etaService->evaluate('2026-11-10T12:00:00Z', '2026-11-10T12:00:00Z', 12);
        $this->assertFalse($onTime['is_delayed']);
        $this->assertSame('NONE', $onTime['severity']);

        $low = $etaService->evaluate('2026-11-10T12:00:00Z', '2026-11-10T16:00:00Z', 12);
        $this->assertTrue($low['is_delayed']);
        $this->assertSame('LOW', $low['severity']);
        $this->assertFalse($low['exceeds_group_threshold']);

        $medium = $etaService->evaluate('2026-11-10T12:00:00Z', '2026-11-11T04:00:00Z', 12);
        $this->assertSame('MEDIUM', $medium['severity']);
        $this->assertTrue($medium['exceeds_group_threshold']);

        $high = $etaService->evaluate('2026-11-10T12:00:00Z', '2026-11-12T18:00:00Z', 12);
        $this->assertSame('HIGH', $high['severity']);
        $this->assertTrue($high['exceeds_group_threshold']);
    }
}
