<?php

namespace App\Services;

use Carbon\Carbon;

class EtaService
{
    /**
     * Deterministic ETA & delay evaluation (Brief Slide 8 & Slide 15).
     *
     * Rules:
     * - If estimated_arrival > expected_arrival, shipment is marked delayed.
     * - Delay 0–6 hours: LOW
     * - Delay >6–24 hours: MEDIUM
     * - Delay >24 hours: HIGH
     * - Group threshold (default 12h for Group A) is configurable without code changes.
     */
    public function evaluate(string|\DateTimeInterface $expectedArrival, string|\DateTimeInterface $estimatedArrival, ?int $thresholdHours = null): array
    {
        $expected = Carbon::parse($expectedArrival);
        $estimated = Carbon::parse($estimatedArrival);
        $groupThreshold = $thresholdHours ?? (int) config('cargotrace.delay_threshold_hours', 12);

        $diffMinutes = $expected->diffInMinutes($estimated, false);
        $delayHours = $diffMinutes > 0 ? round($diffMinutes / 60, 1) : 0.0;
        $isDelayed = $delayHours > 0;

        $severity = 'NONE';
        if ($isDelayed) {
            if ($delayHours <= 6.0) {
                $severity = 'LOW';
            } elseif ($delayHours <= 24.0) {
                $severity = 'MEDIUM';
            } else {
                $severity = 'HIGH';
            }
        }

        $exceedsThreshold = $delayHours > $groupThreshold;

        $explanation = !$isDelayed
            ? "On time (ETA matches or precedes expected arrival; threshold {$groupThreshold}h)."
            : sprintf(
                'Delayed by %.1fh (%s severity: %s; Group threshold %dh %s).',
                $delayHours,
                $severity,
                $severity === 'LOW' ? '0–6h' : ($severity === 'MEDIUM' ? '>6–24h' : '>24h'),
                $groupThreshold,
                $exceedsThreshold ? 'EXCEEDED' : 'within limit'
            );

        return [
            'is_delayed' => $isDelayed,
            'delay_hours' => $delayHours,
            'severity' => $severity,
            'threshold_hours' => $groupThreshold,
            'exceeds_group_threshold' => $exceedsThreshold,
            'explanation' => $explanation,
        ];
    }
}
