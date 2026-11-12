<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the DND Atlas Worldwide database from the canonical TypeScript
     * seed dataset (src/data/seedCargoTrace.ts), exported to
     * database/seeders/data/seed.json via `npm run seed:dump`.
     * Demo password for every seed account: password123.
     */
    public function run(): void
    {
        $seed = json_decode(file_get_contents(database_path('seeders/data/seed.json')), true);

        $ts = fn ($v) => $v ? Carbon::parse($v)->format('Y-m-d H:i:s') : null;
        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($seed, $ts, $now) {
            $g = $seed['groupSettings'];
            DB::table('group_settings')->insert([
                'id' => 1,
                'group_name' => $g['group_name'],
                'primary_route_corridor' => $g['primary_route_focus'],
                'delay_threshold_hours' => $g['delay_threshold_hours'],
                'main_exception_focus' => $g['main_exception_focus'],
                'primary_kpi' => $g['group_kpi_label'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($seed['users'] as $u) {
                DB::table('users')->insert([
                    'id' => $u['id'],
                    'name' => $u['name'],
                    'email' => $u['email'],
                    'password' => Hash::make('password123'),
                    'role' => $u['role'],
                    'company_name' => $u['company_name'],
                    'avatar_initials' => $u['avatar_initials'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            foreach ($seed['carriers'] as $c) {
                DB::table('carriers')->insert([
                    'id' => $c['id'],
                    'code' => $c['code'],
                    'name' => $c['name'],
                    'mode' => $c['mode'],
                    'contact_email' => $c['contact_email'],
                    'fleet_summary' => $c['fleet_summary'],
                    'active' => $c['active'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            foreach ($seed['locations'] as $l) {
                DB::table('locations')->insert([
                    'id' => $l['id'],
                    'code' => $l['code'],
                    'name' => $l['name'],
                    'city' => $l['city'],
                    'country' => $l['country'],
                    'type' => $l['type'],
                    'latitude' => $l['latitude'],
                    'longitude' => $l['longitude'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            foreach ($seed['shipments'] as $s) {
                DB::table('shipments')->insert([
                    'id' => $s['id'],
                    'shipment_number' => $s['shipment_number'],
                    'route_code' => $s['route_code'],
                    'customer_id' => $s['customer_id'],
                    'carrier_id' => $s['carrier_id'],
                    'mode' => $s['mode'],
                    'vehicle_ref' => $s['vehicle_ref'],
                    'origin_location_id' => $s['origin_location_id'],
                    'destination_location_id' => $s['destination_location_id'],
                    'cargo_type' => $s['cargo_type'],
                    'total_weight_kg' => $s['total_weight_kg'],
                    'total_volume_cbm' => $s['total_volume_cbm'],
                    'expected_departure' => $ts($s['expected_departure']),
                    'expected_arrival' => $ts($s['expected_arrival']),
                    'estimated_arrival' => $ts($s['estimated_arrival']),
                    'actual_arrival' => $ts($s['actual_arrival']),
                    'status' => $s['status'],
                    'created_at' => $ts($s['created_at']),
                    'updated_at' => $ts($s['updated_at']),
                ]);
            }

            foreach ($seed['items'] as $i) {
                DB::table('shipment_items')->insert([
                    'id' => $i['id'],
                    'shipment_id' => $i['shipment_id'],
                    'sku' => $i['sku'],
                    'description' => $i['description'],
                    'quantity' => $i['quantity'],
                    'unit' => $i['unit_type'],
                    'weight_kg' => $i['weight_kg'],
                    'volume_cbm' => $i['volume_cbm'],
                    'hs_code' => $i['hs_code'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            foreach ($seed['events'] as $e) {
                DB::table('tracking_events')->insert([
                    'id' => $e['id'],
                    'shipment_id' => $e['shipment_id'],
                    'event_code' => $e['event_type'],
                    'resulting_status' => $e['status_after'],
                    'occurred_at' => $ts($e['event_timestamp']),
                    'location_id' => $e['location_id'],
                    'location_name' => $e['location_name'],
                    'latitude' => $e['latitude'],
                    'longitude' => $e['longitude'],
                    'description' => $e['description'],
                    'is_exception' => $e['is_exception'],
                    'recorded_by_user_id' => $e['created_by_user_id'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            foreach ($seed['exceptions'] as $x) {
                DB::table('shipment_exceptions')->insert([
                    'id' => $x['id'],
                    'shipment_id' => $x['shipment_id'],
                    'exception_type' => $x['exception_type'],
                    'severity' => $x['severity'],
                    'status' => $x['status'],
                    'title' => $x['title'],
                    'description' => $x['description'],
                    'detected_at' => $ts($x['detected_at']),
                    'resolved_at' => $ts($x['resolved_at']),
                    'resolution_notes' => $x['resolution_notes'],
                    'reported_by_user_id' => $x['reported_by_user_id'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            foreach ($seed['notifications'] as $n) {
                DB::table('notifications')->insert([
                    'id' => $n['id'],
                    'user_id' => $n['user_id'],
                    'shipment_id' => $n['shipment_id'],
                    'shipment_number' => $n['shipment_number'],
                    'title' => $n['title'],
                    'message' => $n['message'],
                    'type' => $n['type'],
                    'is_read' => $n['is_read'],
                    'created_at' => $ts($n['created_at']),
                ]);
            }

            foreach ($seed['auditLogs'] as $a) {
                DB::table('audit_logs')->insert([
                    'id' => $a['id'],
                    'actor_user_id' => $a['actor_user_id'],
                    'action' => $a['action'],
                    'entity_type' => $a['entity_type'],
                    'entity_id' => $a['entity_id'],
                    'summary' => $a['summary'],
                    'created_at' => $ts($a['created_at']),
                ]);
            }
        });
    }
}
