import React from 'react';
import {
  ExceptionStatus,
  LocationType,
  SeverityLevel,
  ShipmentStatus,
  TransportMode,
} from '../types/cargotrace';
import {
  Anchor,
  Plane,
  Building2,
} from 'lucide-react';
import seaShipPhoto from '../assets/images/vehicle_sea_ship_1794057883264.jpg';
import airPlanePhoto from '../assets/images/vehicle_air_plane_1794057885938.jpg';
import roadTruckPhoto from '../assets/images/vehicle_road_truck_1794057882262.jpg';

export const VEHICLE_PHOTO_BY_MODE: Record<TransportMode, string> = {
  [TransportMode.SEA]: seaShipPhoto,
  [TransportMode.AIR]: airPlanePhoto,
  [TransportMode.ROAD]: roadTruckPhoto,
};

/**
 * Bespoke Corporate Maritime & Multimodal Crest + Typographic Lockup for DND Atlas Worldwide.
 * Replaces generic rounded-square icons with a custom octagonal naval/aviation compass-meridian crest
 * and architectural display typography ('Outfit' + 'Space Grotesk').
 */
export const DndAtlasBrandMark: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  subtitle?: string;
}> = ({ size = 'md', iconOnly = false, subtitle }) => {
  const dims =
    size === 'lg'
      ? { crest: 'w-11 h-11', title: 'text-[21px]', sub: 'text-[10px]', rule: 'w-4' }
      : size === 'sm'
      ? { crest: 'w-8 h-8', title: 'text-[14.5px]', sub: 'text-[8.5px]', rule: 'w-2.5' }
      : { crest: 'w-9 h-9', title: 'text-[17px]', sub: 'text-[9.5px]', rule: 'w-3' };

  return (
    <div className="inline-flex items-center gap-3 select-none min-w-0">
      {/* Custom Architectural Compass-Meridian Naval Crest (SVG) */}
      <svg
        viewBox="0 0 48 48"
        className={`${dims.crest} shrink-0 drop-shadow-[0_2px_6px_rgba(7,45,89,0.18)]`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dndNavalShield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0A3970" />
            <stop offset="55%" stopColor="#072D59" />
            <stop offset="100%" stopColor="#041B38" />
          </linearGradient>
          <linearGradient id="dndCyanWing" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#BAE6FD" />
          </linearGradient>
        </defs>

        {/* Chamfered Octagonal Maritime Shield Base */}
        <polygon
          points="14,2 34,2 46,14 46,34 34,46 14,46 2,34 2,14"
          fill="url(#dndNavalShield)"
          stroke="#1E4E8C"
          strokeWidth="1.5"
        />

        {/* Inner Precision Bevel Frame */}
        <polygon
          points="15.5,5 32.5,5 43,15.5 43,32.5 32.5,43 15.5,43 5,32.5 5,15.5"
          fill="none"
          stroke="#38BDF8"
          strokeOpacity="0.28"
          strokeWidth="0.9"
        />

        {/* Cardinal Degree Ticks (N / E / S / W) */}
        <line x1="24" y1="5.5" x2="24" y2="8.5" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="42.5" y1="24" x2="39.5" y2="24" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="24" y1="42.5" x2="24" y2="39.5" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="5.5" y1="24" x2="8.5" y2="24" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />

        {/* Global Latitude Ring */}
        <circle
          cx="24"
          cy="24"
          r="12.5"
          fill="none"
          stroke="#93C5FD"
          strokeOpacity="0.45"
          strokeWidth="1.1"
          strokeDasharray="2.5 2"
        />

        {/* Tilted Great-Circle Trade Corridor Orbit */}
        <ellipse
          cx="24"
          cy="24"
          rx="15.5"
          ry="6.2"
          transform="rotate(-28 24 24)"
          fill="none"
          stroke="url(#dndCyanWing)"
          strokeWidth="1.75"
        />

        {/* 4-Point Nautical Compass Rose & Forward Vector Wing */}
        <path
          d="M24 8.5 L27.2 20.8 L39.5 24 L27.2 27.2 L24 39.5 L20.8 27.2 L8.5 24 L20.8 20.8 Z"
          fill="#FFFFFF"
        />
        <path
          d="M24 8.5 L27.2 20.8 L39.5 24 L24 24 Z"
          fill="#38BDF8"
        />

        {/* Center Axis Hub */}
        <circle cx="24" cy="24" r="2.6" fill="#072D59" stroke="#FFFFFF" strokeWidth="1.3" />
      </svg>

      {!iconOnly && (
        <div className="flex flex-col justify-center leading-none min-w-0">
          {/* Primary Wordmark: DND / ATLAS */}
          <div className={`font-brand-display ${dims.title} flex items-baseline gap-1.5 tracking-[0.04em] whitespace-nowrap`}>
            <span className="font-black text-[#072D59]">DND</span>
            <span className="font-bold text-[#0284C7] text-[0.82em] -mx-0.5">/</span>
            <span className="font-extrabold text-[#0F172A] tracking-[0.07em]">ATLAS</span>
          </div>

          {/* Secondary Sub-Label: Hairline Rule + WORLDWIDE */}
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <span className={`${dims.rule} h-[1.5px] bg-[#0284C7] shrink-0 rounded-full`} />
            <span
              className={`font-brand-sub ${dims.sub} font-bold uppercase tracking-[0.24em] text-[#475569] truncate`}
            >
              {subtitle || 'WORLDWIDE'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const ModeIconChip: React.FC<{
  mode: TransportMode;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}> = ({ mode, size = 'md', showLabel = false }) => {
  const config = {
    [TransportMode.SEA]: {
      photo: seaShipPhoto,
      bg: 'bg-[#F0F7FF]',
      border: 'border-[#B8E2F8]',
      label: 'Sea Freight',
      alt: 'Container Vessel',
    },
    [TransportMode.AIR]: {
      photo: airPlanePhoto,
      bg: 'bg-[#F2F6FC]',
      border: 'border-[#C6D9F1]',
      label: 'Air Freight',
      alt: 'Cargo Freighter Aircraft',
    },
    [TransportMode.ROAD]: {
      photo: roadTruckPhoto,
      bg: 'bg-[#F3FAF9]',
      border: 'border-[#BCE3E8]',
      label: 'Road Freight',
      alt: 'Heavy Logistics Truck',
    },
  }[mode];

  const boxSize =
    size === 'sm'
      ? 'w-14 h-9 rounded-lg'
      : size === 'lg'
      ? 'w-20 h-12 rounded-xl'
      : 'w-16 h-10 rounded-lg';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div
        className={`${boxSize} ${config.bg} border ${config.border} overflow-hidden flex items-center justify-center shrink-0 shadow-2xs`}
        title={config.label}
      >
        <img
          src={config.photo}
          alt={config.alt}
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
      </div>
      {showLabel && (
        <span className="text-[13px] font-semibold text-[#072D59] whitespace-nowrap">
          {config.label}
        </span>
      )}
    </div>
  );
};

export const LocationTypeBadge: React.FC<{ type: LocationType }> = ({ type }) => {
  const map = {
    [LocationType.SEAPORT]: {
      icon: Anchor,
      label: 'Seaport',
      cls: 'text-[#072D59]',
    },
    [LocationType.AIRPORT]: {
      icon: Plane,
      label: 'Airport',
      cls: 'text-[#3E6FB4]',
    },
    [LocationType.DEPOT]: {
      icon: Building2,
      label: 'Road Depot',
      cls: 'text-[#2F8F9A]',
    },
  }[type];
  const Icon = map.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap ${map.cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{map.label}</span>
    </span>
  );
};

export const ShipmentStatusBadge: React.FC<{
  status: ShipmentStatus;
  isDelayed?: boolean;
}> = ({ status, isDelayed = false }) => {
  const statusLabels: Record<ShipmentStatus, string> = {
    [ShipmentStatus.CREATED]: 'Created',
    [ShipmentStatus.BOOKED]: 'Booked',
    [ShipmentStatus.PICKED_UP]: 'Picked Up',
    [ShipmentStatus.IN_TRANSIT]: 'In Transit',
    [ShipmentStatus.DELIVERED]: 'Delivered',
  };

  if (isDelayed && status !== ShipmentStatus.DELIVERED) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11.5px] font-semibold bg-[#FFF0F3] text-[#9F1D35] border border-[#FD6E88]/70 whitespace-nowrap">
        Delayed · {statusLabels[status]}
      </span>
    );
  }

  const styles: Record<ShipmentStatus, { label: string; cls: string }> = {
    [ShipmentStatus.CREATED]: {
      label: 'Created',
      cls: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
    },
    [ShipmentStatus.BOOKED]: {
      label: 'Booked',
      cls: 'bg-[#DBF2FC] text-[#072D59] border-[#B8E2F8]',
    },
    [ShipmentStatus.PICKED_UP]: {
      label: 'Picked Up',
      cls: 'bg-[#E6EEF9] text-[#072D59] border-[#C6D9F1]',
    },
    [ShipmentStatus.IN_TRANSIT]: {
      label: 'In Transit',
      cls: 'bg-[#072D59] text-white border-[#072D59]',
    },
    [ShipmentStatus.DELIVERED]: {
      label: 'Delivered',
      cls: 'bg-[#E5F3EC] text-[#2B6E51] border-[#B8E0CC]',
    },
  };

  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11.5px] font-semibold border whitespace-nowrap ${s.cls}`}
    >
      {s.label}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: SeverityLevel }> = ({ severity }) => {
  if (severity === SeverityLevel.NONE) {
    return (
      <span className="text-[12px] font-medium text-[#2B6E51] whitespace-nowrap">
        On schedule
      </span>
    );
  }

  const styles: Record<Exclude<SeverityLevel, SeverityLevel.NONE>, { label: string; cls: string }> = {
    [SeverityLevel.LOW]: {
      label: 'Minor delay (0–6h)',
      cls: 'text-[#475569]',
    },
    [SeverityLevel.MEDIUM]: {
      label: 'Moderate delay (6–24h)',
      cls: 'text-[#975A16]',
    },
    [SeverityLevel.HIGH]: {
      label: 'Severe delay (>24h)',
      cls: 'text-[#9F1D35]',
    },
  };

  const s = styles[severity];
  return (
    <span className={`text-[12px] font-semibold whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
};

export const ExceptionStatusBadge: React.FC<{ status: ExceptionStatus }> = ({ status }) => {
  const styles: Record<ExceptionStatus, { label: string; cls: string }> = {
    [ExceptionStatus.OPEN]: {
      label: 'Open Hold',
      cls: 'bg-[#FFF0F3] text-[#9F1D35] border-[#FD6E88]/80',
    },
    [ExceptionStatus.INVESTIGATING]: {
      label: 'Under Review',
      cls: 'bg-[#DBF2FC] text-[#072D59] border-[#9BD4F0]',
    },
    [ExceptionStatus.RESOLVED]: {
      label: 'Resolved',
      cls: 'bg-[#E5F3EC] text-[#2B6E51] border-[#B8E0CC]',
    },
  };
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11.5px] font-semibold border whitespace-nowrap ${s.cls}`}
    >
      {s.label}
    </span>
  );
};

/**
 * KPI Metric Card matching the Yuke.inc reference screenshot (`image.png`):
 * - Top progress bar + percentage separated by a clean hairline border
 * - Middle icon + metric label
 * - Large tabular value (`40/46`) + muted unit label (`Shipped`)
 */
export const KpiStatCard: React.FC<{
  percentage: number;
  barColorHex: string;
  icon: React.ReactNode;
  label: string;
  primaryValue: string;
  unitLabel: string;
  subtitleNote?: string;
  onClick?: () => void;
}> = ({
  percentage,
  barColorHex,
  icon,
  label,
  primaryValue,
  unitLabel,
  subtitleNote,
  onClick,
}) => {
  const clampedPct = Math.max(4, Math.min(100, Math.round(percentage)));

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={`bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3.5 transition-all shadow-2xs ${
        onClick ? 'cursor-pointer hover:border-[#072D59]/40 hover:shadow-sm' : ''
      }`}
    >
      {/* Top row: Progress bar + Percentage with bottom hairline divider like Yuke.inc */}
      <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-[#F1F5F9]">
        <div className="flex-1 h-1.5 bg-[#EDF2F7] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${clampedPct}%`, backgroundColor: barColorHex }}
          />
        </div>
        <span className="text-[12px] font-semibold text-[#334155] tabular-nums shrink-0">
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Middle row: Icon + Label */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[#475569] shrink-0">{icon}</span>
        <span className="text-[12.5px] font-medium text-[#334155] truncate">{label}</span>
      </div>

      {/* Bottom row: Large value + muted unit */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold text-[#0F172A] tabular-nums tracking-tight leading-none">
          {primaryValue}
        </span>
        <span className="text-[16px] font-normal text-[#64748B] leading-none">{unitLabel}</span>
      </div>

      {subtitleNote && (
        <div className="mt-1.5 text-[11px] text-[#64748B] truncate">{subtitleNote}</div>
      )}
    </div>
  );
};
