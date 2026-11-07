import React, { useEffect, useState } from 'react';
import {
  Carrier,
  ExceptionStatus,
  ExceptionType,
  GroupConfigSettings,
  Location,
  ModeEventType,
  SeverityLevel,
  Shipment,
  ShipmentException,
  ShipmentItem,
  ShipmentStatus,
  TrackingEvent,
  User,
  WeatherSnapshot,
} from '../types/cargotrace';
import {
  AuthPolicyService,
  EtaService,
  MODE_EVENT_VOCABULARY,
  calculateHaversineKm,
  calculateHaversineMiles,
  formatEnumLabel,
} from '../services/CargoTraceService';
import { ExternalApiService } from '../services/ExternalApiService';
import {
  ExceptionStatusBadge,
  ModeIconChip,
  ShipmentStatusBadge,
} from './CargoTraceUI';
import { CargoTraceLeafletMap } from './CargoTraceLeafletMap';
import {
  X,
  MapPin,
  AlertTriangle,
  Plus,
  CloudSun,
  Navigation,
} from 'lucide-react';

interface ShipmentDetailModalProps {
  shipment: Shipment | null;
  currentUser: User;
  locations: Location[];
  carriers: Carrier[];
  items: ShipmentItem[];
  events: TrackingEvent[];
  exceptions: ShipmentException[];
  settings: GroupConfigSettings;
  onClose: () => void;
  onAddTrackingEvent: (payload: {
    shipment_id: number;
    event_type: ModeEventType;
    status_after: ShipmentStatus | null;
    event_timestamp: string;
    location_id: number | null;
    location_name: string;
    latitude: number;
    longitude: number;
    description: string;
    revised_eta?: string;
  }) => { valid: boolean; message: string };
  onReportException: (payload: {
    shipment_id: number;
    exception_type: ExceptionType;
    severity: SeverityLevel;
    title: string;
    description: string;
    delay_hours_added: number;
  }) => { valid: boolean; message: string };
  onResolveException: (exceptionId: number, notes: string) => void;
}

export const ShipmentDetailModal: React.FC<ShipmentDetailModalProps> = ({
  shipment,
  currentUser,
  locations,
  carriers,
  items,
  events,
  exceptions,
  settings,
  onClose,
  onAddTrackingEvent,
  onReportException,
  onResolveException,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'map' | 'cargo' | 'exceptions'>('timeline');
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Add Tracking Event Form State
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventType, setEventType] = useState<ModeEventType>('LOCATION_UPDATE');
  const [statusAfter, setStatusAfter] = useState<string>('');
  const [eventLocationId, setEventLocationId] = useState<number>(0);
  const [eventDescription, setEventDescription] = useState('');
  const [eventTimestamp, setEventTimestamp] = useState('2026-11-05T04:00');
  const [revisedEta, setRevisedEta] = useState('');
  const [formFeedback, setFormFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Report Exception Form State
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [excType, setExcType] = useState<ExceptionType>(ExceptionType.CUSTOMS_HOLD);
  const [excSeverity, setExcSeverity] = useState<SeverityLevel>(SeverityLevel.MEDIUM);
  const [excTitle, setExcTitle] = useState('');
  const [excDesc, setExcDesc] = useState('');
  const [excDelayAdded, setExcDelayAdded] = useState<number>(14);

  useEffect(() => {
    if (!shipment) return;
    const vocab = MODE_EVENT_VOCABULARY[shipment.mode] || ['LOCATION_UPDATE'];
    setEventType(vocab[0]);
    setStatusAfter('');
    setEventLocationId(shipment.destination_location_id);
    setEventDescription('');
    setRevisedEta(shipment.estimated_arrival.slice(0, 16));
    setFormFeedback(null);

    const destLoc = locations.find((l) => l.id === shipment.destination_location_id);
    if (destLoc) {
      setWeatherLoading(true);
      ExternalApiService.fetchLocationWeather(destLoc).then((snap) => {
        setWeather(snap);
        setWeatherLoading(false);
      });
    }

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shipment, locations, onClose]);

  if (!shipment) return null;

  // Enforce server-grade authorization check
  const viewAuth = AuthPolicyService.canViewShipment(currentUser, shipment);
  const canMutate = AuthPolicyService.canMutateShipment(currentUser).valid;

  if (!viewAuth.valid) {
    return (
      <div className="fixed inset-0 z-50 bg-[#072D59]/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white border border-[#FD6E88] rounded-xl max-w-md w-full p-6 shadow-xl">
          <div className="flex items-center gap-2 text-[#9F1D35] font-bold text-base mb-2">
            <AlertTriangle className="w-5 h-5 text-[#FD6E88]" />
            <span>Access Denied ({viewAuth.status_code})</span>
          </div>
          <p className="text-[13.5px] text-[#1E293B] mb-4">{viewAuth.message}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#072D59] text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const origin = locations.find((l) => l.id === shipment.origin_location_id);
  const destination = locations.find((l) => l.id === shipment.destination_location_id);
  const carrier = carriers.find((c) => c.id === shipment.carrier_id);

  const shipmentEvents = [...events]
    .filter((e) => e.shipment_id === shipment.id)
    .sort(
      (a, b) =>
        new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
    );

  const latestEvent =
    shipmentEvents.length > 0 ? shipmentEvents[shipmentEvents.length - 1] : null;

  const shipmentExceptions = exceptions.filter((ex) => ex.shipment_id === shipment.id);
  const shipmentItems = items.filter((it) => it.shipment_id === shipment.id);

  const etaEval = EtaService.evaluate(
    shipment.expected_arrival,
    shipment.estimated_arrival,
    settings
  );

  const distanceKm =
    origin && destination
      ? calculateHaversineKm(
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude
        )
      : 0;
  const distanceMi =
    origin && destination
      ? calculateHaversineMiles(
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude
        )
      : 0;

  const allowedEvents = MODE_EVENT_VOCABULARY[shipment.mode] || [];
  const isDelayedActive = etaEval.is_delayed && shipment.status !== ShipmentStatus.DELIVERED;

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenLoc = locations.find((l) => l.id === Number(eventLocationId)) || destination || origin;
    const isoTs = eventTimestamp.endsWith('Z')
      ? eventTimestamp
      : `${eventTimestamp}:00Z`;
    const revisedIso =
      revisedEta && revisedEta.trim()
        ? revisedEta.endsWith('Z')
          ? revisedEta
          : `${revisedEta}:00Z`
        : undefined;

    const result = onAddTrackingEvent({
      shipment_id: shipment.id,
      event_type: eventType,
      status_after: statusAfter ? (statusAfter as ShipmentStatus) : null,
      event_timestamp: isoTs,
      location_id: chosenLoc ? chosenLoc.id : null,
      location_name: chosenLoc ? `${chosenLoc.name} (${chosenLoc.city})` : 'In-Transit Checkpoint',
      latitude: chosenLoc ? chosenLoc.latitude : 0,
      longitude: chosenLoc ? chosenLoc.longitude : 0,
      description: eventDescription,
      revised_eta: revisedIso,
    });

    if (!result.valid) {
      setFormFeedback({ type: 'error', text: result.message });
    } else {
      setFormFeedback({ type: 'success', text: result.message });
      setEventDescription('');
      setShowEventForm(false);
    }
  };

  const handleExceptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onReportException({
      shipment_id: shipment.id,
      exception_type: excType,
      severity: excSeverity,
      title: excTitle,
      description: excDesc,
      delay_hours_added: Number(excDelayAdded) || 0,
    });

    if (!res.valid) {
      setFormFeedback({ type: 'error', text: res.message });
    } else {
      setFormFeedback({ type: 'success', text: res.message });
      setExcTitle('');
      setExcDesc('');
      setShowExceptionForm(false);
      setActiveTab('exceptions');
    }
  };

  const lifecycleStages = [
    ShipmentStatus.CREATED,
    ShipmentStatus.BOOKED,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.DELIVERED,
  ] as const;
  const currentStageIndex = lifecycleStages.indexOf(shipment.status);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#072D59]/40 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-label={`Shipment details for ${shipment.shipment_number}`}
    >
      <div className="bg-[#F8FAFC] w-full max-w-[780px] h-full flex flex-col border-l border-[#DCE4F0] shadow-2xl overflow-hidden">
        {/* Top Modal Header — Clean single-status layout without badge sandwiches */}
        <div className="px-6 py-4 bg-white border-b border-[#DCE4F0] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <ModeIconChip mode={shipment.mode} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[19px] font-bold text-[#072D59] font-mono-tabular tracking-tight">
                  {shipment.shipment_number}
                </h2>
                <ShipmentStatusBadge
                  status={shipment.status}
                  isDelayed={isDelayedActive}
                />
              </div>
              <div className="text-[13px] text-[#475569] mt-1 flex flex-wrap items-center gap-1.5">
                <span className="font-mono-tabular font-semibold text-[#1E293B]">
                  {shipment.route_code}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {origin?.city} ({origin?.code}) → {destination?.city} ({destination?.code})
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shipment details"
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#072D59] hover:bg-[#F1F5F9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean Lifecycle Progress Bar (No numbered circles or all-caps shouting) */}
        <div className="px-6 py-3 bg-white border-b border-[#DCE4F0]">
          <div className="grid grid-cols-5 gap-2">
            {lifecycleStages.map((stage, idx) => {
              const isCompleted = idx <= currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div key={stage} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isCurrent
                        ? isDelayedActive
                          ? 'bg-[#FD6E88]'
                          : 'bg-[#072D59]'
                        : isCompleted
                        ? 'bg-[#3E6FB4]'
                        : 'bg-[#E2E8F0]'
                    }`}
                  />
                  <div
                    className={`text-[12px] truncate ${
                      isCurrent
                        ? 'font-bold text-[#072D59]'
                        : isCompleted
                        ? 'font-medium text-[#1E293B]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {formatEnumLabel(stage)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Feedback Banner */}
          {formFeedback && (
            <div
              className={`p-3.5 rounded-lg border text-[13px] flex items-center justify-between ${
                formFeedback.type === 'error'
                  ? 'bg-[#FFF0F3] border-[#FD6E88] text-[#9F1D35]'
                  : 'bg-[#DBF2FC] border-[#9BD4F0] text-[#072D59]'
              }`}
            >
              <span className="font-medium">{formFeedback.text}</span>
              <button
                type="button"
                onClick={() => setFormFeedback(null)}
                className="text-xs font-semibold underline ml-3"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Flat Schedule & Arrival Strip (No nested cards within cards) */}
          <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold text-[#072D59]">
                Arrival Schedule & Variance
              </span>
              <span className="text-[12px] text-[#475569] tabular-nums">
                Alert threshold: {settings.delay_threshold_hours}h ({settings.group_name})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4F0]">
              <div className="p-3.5">
                <div className="text-[11.5px] text-[#475569]">Scheduled Arrival</div>
                <div className="text-[13.5px] font-semibold text-[#072D59] tabular-nums mt-0.5">
                  {new Date(shipment.expected_arrival).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  UTC
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11.5px] text-[#475569]">Estimated Arrival (ETA)</div>
                <div className="text-[13.5px] font-semibold text-[#072D59] tabular-nums mt-0.5">
                  {new Date(shipment.estimated_arrival).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  UTC
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11.5px] text-[#475569]">Schedule Variance</div>
                <div
                  className={`text-[13.5px] font-bold tabular-nums mt-0.5 ${
                    etaEval.delay_hours > 0 ? 'text-[#9F1D35]' : 'text-[#2B6E51]'
                  }`}
                >
                  {etaEval.delay_hours > 0
                    ? `+${etaEval.delay_hours} hours`
                    : 'On schedule'}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11.5px] text-[#475569]">Last Recorded Checkpoint</div>
                <div className="text-[13px] font-semibold text-[#1E293B] mt-0.5 leading-snug">
                  {latestEvent ? latestEvent.location_name : origin?.name}
                </div>
              </div>
            </div>

            <div
              className={`px-4 py-2.5 border-t text-[12.5px] flex items-center justify-between gap-2 ${
                isDelayedActive
                  ? 'bg-[#FFF0F3]/70 border-[#FD6E88]/40 text-[#9F1D35]'
                  : 'bg-[#F8FAFC] border-[#DCE4F0] text-[#1E293B]'
              }`}
            >
              <span>{etaEval.reason}</span>
            </div>
          </div>

          {/* 2-Column Waybill Details & Destination Weather */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Waybill & Transport Details — Clean left-aligned definition list */}
            <div className="bg-white border border-[#DCE4F0] rounded-xl p-4">
              <h3 className="text-[13px] font-bold text-[#072D59] pb-2.5 mb-3 border-b border-[#EEF2F8]">
                Waybill & Transport Details
              </h3>
              <dl className="grid grid-cols-[120px_1fr] gap-y-2.5 gap-x-3 text-[13px]">
                <dt className="text-[#475569]">Customer</dt>
                <dd className="font-semibold text-[#1E293B]">{shipment.customer_name}</dd>

                <dt className="text-[#475569]">Carrier</dt>
                <dd className="font-semibold text-[#1E293B]">
                  {carrier?.name} · {formatEnumLabel(shipment.mode)}
                </dd>

                <dt className="text-[#475569]">Vessel / Vehicle</dt>
                <dd className="font-medium text-[#072D59] tabular-nums">
                  {shipment.vehicle_ref}
                </dd>

                <dt className="text-[#475569]">Origin Hub</dt>
                <dd className="text-[#1E293B]">
                  {origin?.name}{' '}
                  <span className="text-[#475569] text-[12px]">
                    ({origin ? formatEnumLabel(origin.type) : ''})
                  </span>
                </dd>

                <dt className="text-[#475569]">Destination Hub</dt>
                <dd className="text-[#1E293B]">
                  {destination?.name}{' '}
                  <span className="text-[#475569] text-[12px]">
                    ({destination ? formatEnumLabel(destination.type) : ''})
                  </span>
                </dd>

                <dt className="text-[#475569]">Corridor Distance</dt>
                <dd className="text-[#1E293B] tabular-nums">
                  {distanceKm.toLocaleString()} km ({distanceMi.toLocaleString()} mi)
                </dd>
              </dl>
            </div>

            {/* Destination Hub Weather — Flat layout without nested sub-cards */}
            <div className="bg-white border border-[#DCE4F0] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#EEF2F8]">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#072D59]">
                    <CloudSun className="w-4 h-4 text-[#072D59]" />
                    <span>Destination Hub Weather</span>
                  </div>
                  <span className="text-[11.5px] text-[#475569]">
                    {weather?.source.includes('Open-Meteo') ? 'Open-Meteo Live' : 'Cached Telemetry'}
                  </span>
                </div>

                {weatherLoading ? (
                  <div className="py-6 text-[13px] text-[#475569]">
                    Loading destination weather conditions...
                  </div>
                ) : weather ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#1E293B]">
                        {destination?.name} ({destination?.city})
                      </div>
                      <div className="text-[12.5px] text-[#475569] mt-0.5">
                        Condition: <strong className="text-[#072D59]">{weather.condition_label}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-[#DCE4F0] pt-2 border-t border-[#EEF2F8] tabular-nums">
                      <div className="pr-3">
                        <div className="text-[11px] text-[#475569]">Temperature</div>
                        <div className="text-[17px] font-bold text-[#072D59] mt-0.5">
                          {weather.temperature_c}°C
                        </div>
                      </div>
                      <div className="px-3">
                        <div className="text-[11px] text-[#475569]">Wind Speed</div>
                        <div className="text-[17px] font-bold text-[#072D59] mt-0.5">
                          {weather.wind_speed_kmh} <span className="text-[12px] font-normal">km/h</span>
                        </div>
                      </div>
                      <div className="pl-3">
                        <div className="text-[11px] text-[#475569]">Visibility</div>
                        <div className="text-[17px] font-bold text-[#072D59] mt-0.5">
                          {weather.visibility_km} <span className="text-[12px] font-normal">km</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-[13px] text-[#475569]">
                    Weather telemetry unavailable for this destination.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2.5 border-t border-[#EEF2F8] text-[11.5px] text-[#475569]">
                Meteorological conditions at destination hub for operational awareness.
              </div>
            </div>
          </div>

          {/* Sub-navigation Tabs + Operator Action Buttons on One Clean Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE4F0]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                  activeTab === 'timeline'
                    ? 'border-[#072D59] text-[#072D59]'
                    : 'border-transparent text-[#475569] hover:text-[#072D59]'
                }`}
              >
                Timeline ({shipmentEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                  activeTab === 'map'
                    ? 'border-[#072D59] text-[#072D59]'
                    : 'border-transparent text-[#475569] hover:text-[#072D59]'
                }`}
              >
                Route Map
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('exceptions')}
                className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                  activeTab === 'exceptions'
                    ? 'border-[#072D59] text-[#072D59]'
                    : 'border-transparent text-[#475569] hover:text-[#072D59]'
                }`}
              >
                Exceptions ({shipmentExceptions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cargo')}
                className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                  activeTab === 'cargo'
                    ? 'border-[#072D59] text-[#072D59]'
                    : 'border-transparent text-[#475569] hover:text-[#072D59]'
                }`}
              >
                Cargo Manifest ({shipmentItems.length || 1})
              </button>
            </div>

            {canMutate && (
              <div className="flex items-center gap-2 pb-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEventForm((v) => !v);
                    setShowExceptionForm(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#072D59] text-white text-[12px] font-semibold hover:bg-[#051F3E] transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Tracking Event</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExceptionForm((v) => !v);
                    setShowEventForm(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white text-[#9F1D35] border border-[#FD6E88] text-[12px] font-semibold hover:bg-[#FFF0F3] transition-colors inline-flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FD6E88]" />
                  <span>Report Exception</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Tracking Event Form */}
          {showEventForm && canMutate && (
            <form
              onSubmit={handleEventSubmit}
              className="bg-white border border-[#DCE4F0] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-[#072D59]">
                  Record Tracking Milestone ({formatEnumLabel(shipment.mode)} Mode)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEventForm(false)}
                  className="text-xs font-medium text-[#475569] hover:text-[#072D59]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px]">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Milestone Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as ModeEventType)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px] text-[#1E293B]"
                  >
                    {allowedEvents.map((ev) => (
                      <option key={ev} value={ev}>
                        {formatEnumLabel(ev)} ({ev})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Status Transition
                  </label>
                  <select
                    value={statusAfter}
                    onChange={(e) => setStatusAfter(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px] text-[#1E293B]"
                  >
                    <option value="">Keep current ({formatEnumLabel(shipment.status)})</option>
                    {Object.values(ShipmentStatus).map((st) => (
                      <option key={st} value={st}>
                        Transition to {formatEnumLabel(st)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Checkpoint Location
                  </label>
                  <select
                    value={eventLocationId}
                    onChange={(e) => setEventLocationId(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px] text-[#1E293B]"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code} · {formatEnumLabel(loc.type)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Event Timestamp (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={eventTimestamp}
                    onChange={(e) => setEventTimestamp(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px] text-[#1E293B] tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Revised Estimated Arrival (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={revisedEta}
                    onChange={(e) => setRevisedEta(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px] text-[#1E293B] tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Checkpoint Notes
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Container discharged at terminal berth 4 and cleared gate inspection"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-[12.5px] text-[#1E293B]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#072D59] text-white rounded-lg text-[12.5px] font-semibold hover:bg-[#051F3E]"
                >
                  Save Tracking Event
                </button>
              </div>
            </form>
          )}

          {/* Report Exception Form */}
          {showExceptionForm && canMutate && (
            <form
              onSubmit={handleExceptionSubmit}
              className="bg-white border border-[#FD6E88] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-[#9F1D35]">
                  Report Operational Exception
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExceptionForm(false)}
                  className="text-xs font-medium text-[#475569]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12.5px]">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Category
                  </label>
                  <select
                    value={excType}
                    onChange={(e) => setExcType(e.target.value as ExceptionType)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px]"
                  >
                    {Object.values(ExceptionType).map((t) => (
                      <option key={t} value={t}>
                        {formatEnumLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Severity Level
                  </label>
                  <select
                    value={excSeverity}
                    onChange={(e) => setExcSeverity(e.target.value as SeverityLevel)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px]"
                  >
                    <option value={SeverityLevel.LOW}>Low (0–6h)</option>
                    <option value={SeverityLevel.MEDIUM}>Medium (6–24h)</option>
                    <option value={SeverityLevel.HIGH}>High (&gt;24h)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Estimated Delay Impact (+Hours)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={excDelayAdded}
                    onChange={(e) => setExcDelayAdded(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[12.5px] tabular-nums"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Incident Summary
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Physical customs inspection scheduled at terminal"
                    value={excTitle}
                    onChange={(e) => setExcTitle(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-[12.5px]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11.5px] font-semibold text-[#1E293B] mb-1">
                    Operational Details
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Describe root cause and required clearance actions..."
                    value={excDesc}
                    onChange={(e) => setExcDesc(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-[12.5px]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#FD6E88] text-white rounded-lg text-[12.5px] font-semibold hover:bg-[#e55670]"
                >
                  Open Exception & Update ETA
                </button>
              </div>
            </form>
          )}

          {/* TAB 1: CHRONOLOGICAL TIMELINE (Clean structured list, no pill clutter) */}
          {activeTab === 'timeline' && (
            <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden">
              {shipmentEvents.length === 0 ? (
                <div className="p-8 text-center text-[#475569] text-[13px]">
                  No tracking milestones recorded yet for this shipment.
                </div>
              ) : (
                <div className="divide-y divide-[#EEF2F8]">
                  {shipmentEvents.map((ev, index) => {
                    const isLatest = index === shipmentEvents.length - 1;
                    return (
                      <div
                        key={ev.id}
                        className={`p-4 flex items-start gap-3.5 ${
                          ev.is_exception
                            ? 'bg-[#FFF0F3]/40'
                            : isLatest
                            ? 'bg-[#DBF2FC]/25'
                            : 'bg-white'
                        }`}
                      >
                        <div className="pt-1 shrink-0">
                          <span
                            className={`block w-2.5 h-2.5 rounded-full ${
                              ev.is_exception
                                ? 'bg-[#FD6E88]'
                                : isLatest
                                ? 'bg-[#072D59]'
                                : 'bg-[#94A3B8]'
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                              <span className="font-bold text-[#072D59]">
                                {formatEnumLabel(ev.event_type)}
                              </span>
                              {ev.status_after && (
                                <>
                                  <span className="text-[#94A3B8]">·</span>
                                  <span className="font-semibold text-[#1E293B]">
                                    Status → {formatEnumLabel(ev.status_after)}
                                  </span>
                                </>
                              )}
                              {isLatest && (
                                <>
                                  <span className="text-[#94A3B8]">·</span>
                                  <span className="text-[11.5px] font-semibold text-[#072D59]">
                                    Latest checkpoint
                                  </span>
                                </>
                              )}
                            </div>

                            <span className="text-[12px] tabular-nums text-[#475569]">
                              {new Date(ev.event_timestamp).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              UTC
                            </span>
                          </div>

                          <p className="text-[13px] text-[#1E293B] mt-1">{ev.description}</p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[#475569]">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#072D59]" />
                              {ev.location_name}
                            </span>
                            <span>·</span>
                            <span>Logged by {ev.created_by_name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OPENSTREETMAP ROUTE */}
          {activeTab === 'map' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12.5px] text-[#475569]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#072D59]">
                  <Navigation className="w-3.5 h-3.5" />
                  Origin ({origin?.code}) → Active Checkpoint → Destination ({destination?.code})
                </span>
                <span className="tabular-nums">
                  {distanceKm.toLocaleString()} km
                </span>
              </div>
              <CargoTraceLeafletMap
                shipments={[shipment]}
                locations={locations}
                carriers={carriers}
                trackingEvents={shipmentEvents}
                settings={settings}
                selectedShipmentId={shipment.id}
                heightClass="h-[360px]"
                compactControlDefault={true}
              />
            </div>
          )}

          {/* TAB 3: EXCEPTIONS */}
          {activeTab === 'exceptions' && (
            <div className="space-y-3">
              {shipmentExceptions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-[#DCE4F0] text-[#475569] text-[13px]">
                  No operational exceptions recorded for this shipment.
                </div>
              ) : (
                shipmentExceptions.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-4 rounded-xl border border-[#DCE4F0] bg-white space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <ExceptionStatusBadge status={ex.status} />
                        <span className="font-semibold text-[#9F1D35]">
                          {formatEnumLabel(ex.exception_type)}
                        </span>
                        <span className="text-[#94A3B8]">·</span>
                        <span className="text-[#475569]">
                          {ex.severity === SeverityLevel.HIGH
                            ? 'High impact (>24h)'
                            : ex.severity === SeverityLevel.MEDIUM
                            ? 'Medium impact (6–24h)'
                            : 'Low impact (0–6h)'}
                        </span>
                      </div>
                      <span className="text-[12px] tabular-nums text-[#475569]">
                        {new Date(ex.detected_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[14px] font-bold text-[#072D59]">{ex.title}</div>
                    <p className="text-[13px] text-[#1E293B]">{ex.description}</p>
                    {ex.resolution_notes && (
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12.5px] text-[#1E293B]">
                        <strong className="text-[#072D59]">Resolution:</strong> {ex.resolution_notes}
                      </div>
                    )}
                    {canMutate && ex.status !== ExceptionStatus.RESOLVED && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            onResolveException(
                              ex.id,
                              'Verified clearance documentation and released hold.'
                            )
                          }
                          className="px-3.5 py-1.5 bg-[#072D59] text-white rounded-lg text-[12px] font-semibold hover:bg-[#051F3E]"
                        >
                          Mark Exception Resolved
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: CARGO LINE ITEMS */}
          {activeTab === 'cargo' && (
            <div className="bg-white border border-[#DCE4F0] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#DCE4F0] text-[#475569] text-[11.5px]">
                    <th className="py-2.5 px-3.5 font-semibold">SKU</th>
                    <th className="py-2.5 px-3.5 font-semibold">Cargo Description</th>
                    <th className="py-2.5 px-3.5 font-semibold">HS Code</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Quantity</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Weight (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F8]">
                  {shipmentItems.length > 0 ? (
                    shipmentItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3.5 font-mono-tabular font-semibold text-[#072D59]">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-3.5 text-[#1E293B]">{item.description}</td>
                        <td className="py-2.5 px-3.5 font-mono-tabular text-[#475569]">
                          {item.hs_code}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-[#1E293B]">
                          {item.quantity} {item.unit_type}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums font-semibold text-[#072D59]">
                          {item.weight_kg.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5 px-3.5 font-mono-tabular font-semibold text-[#072D59]">
                        SKU-{shipment.id}01
                      </td>
                      <td className="py-2.5 px-3.5 text-[#1E293B]">{shipment.cargo_type}</td>
                      <td className="py-2.5 px-3.5 font-mono-tabular text-[#475569]">8542.31.00</td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums text-[#1E293B]">
                        1 LOT ({shipment.total_volume_cbm} CBM)
                      </td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums font-semibold text-[#072D59]">
                        {shipment.total_weight_kg.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
