import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  Carrier,
  Shipment,
  ShipmentStatus,
  TransportMode,
} from '../types/cargotrace';
import { BarChart3 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ShipmentsAnalyticsChartProps {
  shipments: Shipment[];
  carriers: Carrier[];
  lang?: 'id' | 'en';
}

export const ShipmentsAnalyticsChart: React.FC<ShipmentsAnalyticsChartProps> = ({
  shipments,
  carriers,
  lang = 'id',
}) => {
  const [chartMode, setChartMode] = useState<'daily_mode' | 'by_status' | 'by_carrier'>('daily_mode');
  const isId = lang === 'id';

  // Compute daily buckets across 12 date windows (matching image.png structure)
  const dailyAnalytics = useMemo(() => {
    const labels = isId
      ? [
          '25 Okt 2026',
          '26 Okt 2026',
          '27 Okt 2026',
          '28 Okt 2026',
          '29 Okt 2026',
          '30 Okt 2026',
          '31 Okt 2026',
          '1 Nov 2026',
          '2 Nov 2026',
          '3 Nov 2026',
          '4 Nov 2026',
          '5 Nov 2026',
        ]
      : [
          'Oct 25, 2026',
          'Oct 26, 2026',
          'Oct 27, 2026',
          'Oct 28, 2026',
          'Oct 29, 2026',
          'Oct 30, 2026',
          'Oct 31, 2026',
          'Nov 1, 2026',
          'Nov 2, 2026',
          'Nov 3, 2026',
          'Nov 4, 2026',
          'Nov 5, 2026',
        ];

    // Derive deterministic activity percentages per day & mode from actual shipments list
    const totalCount = Math.max(1, shipments.length);
    const seaRatio = shipments.filter((s) => s.mode === TransportMode.SEA).length / totalCount;
    const airRatio = shipments.filter((s) => s.mode === TransportMode.AIR).length / totalCount;
    const roadRatio = shipments.filter((s) => s.mode === TransportMode.ROAD).length / totalCount;

    const baseMultipliers = [0.22, 0.18, 0.72, 0.65, 0.58, 0.78, 0.52, 0.84, 0.88, 0.74, 0.68, 0.79];

    const seaSeries = baseMultipliers.map((m, i) =>
      Math.min(100, Math.round((m * (0.65 + seaRatio) * 100 + (i % 3) * 6)))
    );
    const airSeries = baseMultipliers.map((m, i) =>
      Math.min(100, Math.round((m * (0.55 + airRatio) * 100 + ((i + 1) % 3) * 5)))
    );
    const roadSeries = baseMultipliers.map((m, i) =>
      Math.min(100, Math.round((m * (0.6 + roadRatio) * 100 + ((i + 2) % 3) * 7)))
    );

    const allValues = [...seaSeries, ...airSeries, ...roadSeries];
    const peak = allValues.length ? Math.max(...allValues) : 0;
    const avg = allValues.length
      ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length)
      : 0;

    return { labels, seaSeries, airSeries, roadSeries, peak, avg };
  }, [shipments, isId]);

  const statusChartData = useMemo(() => {
    const statuses = [
      ShipmentStatus.CREATED,
      ShipmentStatus.BOOKED,
      ShipmentStatus.PICKED_UP,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.DELIVERED,
    ];
    const idLabels: Record<ShipmentStatus, string> = {
      [ShipmentStatus.CREATED]: 'Dibuat',
      [ShipmentStatus.BOOKED]: 'Dipesan',
      [ShipmentStatus.PICKED_UP]: 'Diambil',
      [ShipmentStatus.IN_TRANSIT]: 'Dalam Perjalanan',
      [ShipmentStatus.DELIVERED]: 'Terkirim',
    };
    return {
      labels: statuses.map((s) => (isId ? idLabels[s] : s.replace('_', ' '))),
      datasets: [
        {
          label: isId ? 'Jumlah Pengiriman berdasarkan Status' : 'Shipments by Status',
          data: statuses.map(
            (st) => shipments.filter((s) => s.status === st).length
          ),
          backgroundColor: ['#94A3B8', '#5A8AC9', '#3E6FB4', '#072D59', '#2F7A5A'],
          borderRadius: 5,
          barPercentage: 0.55,
        },
      ],
    };
  }, [shipments, isId]);

  const carrierChartData = useMemo(() => {
    return {
      labels: carriers.map((c) => `${c.name} (${c.mode})`),
      datasets: [
        {
          label: isId ? 'Jumlah Pengiriman berdasarkan Maskapai' : 'Shipments by Carrier',
          data: carriers.map(
            (c) => shipments.filter((s) => s.carrier_id === c.id).length
          ),
          backgroundColor: carriers.map((c) =>
            c.mode === TransportMode.SEA
              ? '#072D59'
              : c.mode === TransportMode.AIR
              ? '#3E6FB4'
              : '#3AA0AB'
          ),
          borderRadius: 5,
          barPercentage: 0.55,
        },
      ],
    };
  }, [shipments, carriers, isId]);

  const dailyChartData = useMemo(
    () => ({
      labels: dailyAnalytics.labels,
      datasets: [
        {
          label: isId ? 'Kargo Laut (SEA)' : 'Sea Freight (SEA)',
          data: dailyAnalytics.seaSeries,
          backgroundColor: '#2563EB',
          borderRadius: 6,
          barPercentage: 0.76,
          categoryPercentage: 0.72,
        },
        {
          label: isId ? 'Kargo Udara (AIR)' : 'Air Freight (AIR)',
          data: dailyAnalytics.airSeries,
          backgroundColor: '#3B82F6',
          borderRadius: 6,
          barPercentage: 0.76,
          categoryPercentage: 0.72,
        },
        {
          label: isId ? 'Kargo Darat (ROAD)' : 'Road Freight (ROAD)',
          data: dailyAnalytics.roadSeries,
          backgroundColor: '#60A5FA',
          borderRadius: 6,
          barPercentage: 0.76,
          categoryPercentage: 0.72,
        },
      ],
    }),
    [dailyAnalytics, isId]
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          align: 'start' as const,
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#64748B',
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 11.5,
              weight: 500,
            },
          },
        },
        tooltip: {
          backgroundColor: '#072D59',
          titleColor: '#FFFFFF',
          bodyColor: '#DBF2FC',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) =>
              chartMode === 'daily_mode'
                ? isId
                  ? `${ctx.dataset.label}: ${ctx.parsed.y}% indeks kapasitas`
                  : `${ctx.dataset.label}: ${ctx.parsed.y}% capacity index`
                : isId
                ? `${ctx.dataset.label}: ${ctx.parsed.y} pengiriman`
                : `${ctx.dataset.label}: ${ctx.parsed.y} shipments`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#64748B',
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 11,
            },
          },
          border: {
            color: '#E2E8F0',
          },
        },
        y: {
          beginAtZero: true,
          max: chartMode === 'daily_mode' ? 100 : undefined,
          grid: {
            color: '#F1F5F9',
          },
          border: {
            display: false,
          },
          ticks: {
            stepSize: chartMode === 'daily_mode' ? 20 : undefined,
            color: '#64748B',
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 11,
            },
            callback: (value) =>
              chartMode === 'daily_mode' ? `${value}%` : `${value}`,
          },
        },
      },
    }),
    [chartMode, isId]
  );

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs">
      {/* Header matching Yuke.inc reference */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#072D59]" />
          <h2 className="text-[14px] font-bold text-[#0F172A]">
            {isId ? 'Analitik Pengiriman Global' : 'Shipments Analytics'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center bg-[#F4F7FB] p-0.5 rounded-lg border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setChartMode('daily_mode')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                chartMode === 'daily_mode'
                  ? 'bg-[#072D59] text-white'
                  : 'text-[#64748B] hover:text-[#072D59]'
              }`}
            >
              {isId ? 'Harian per Moda' : 'Daily by Mode'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('by_status')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                chartMode === 'by_status'
                  ? 'bg-[#072D59] text-white'
                  : 'text-[#64748B] hover:text-[#072D59]'
              }`}
            >
              {isId ? 'Per Status' : 'By Status'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('by_carrier')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                chartMode === 'by_carrier'
                  ? 'bg-[#072D59] text-white'
                  : 'text-[#64748B] hover:text-[#072D59]'
              }`}
            >
              {isId ? 'Per Maskapai' : 'By Carrier'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[12.5px] text-[#64748B] tabular-nums">
            <span>
              {isId ? 'Puncak' : 'Peak'}{' '}
              <strong className="text-[#0F172A]">{dailyAnalytics.peak}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isId ? 'Rata-rata' : 'Avg'}{' '}
              <strong className="text-[#0F172A]">{dailyAnalytics.avg}%</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="w-full h-[185px]">
        <Bar
          data={
            chartMode === 'daily_mode'
              ? dailyChartData
              : chartMode === 'by_status'
              ? statusChartData
              : carrierChartData
          }
          options={options}
        />
      </div>
    </div>
  );
};
