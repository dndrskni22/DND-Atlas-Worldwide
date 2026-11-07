import React, { useEffect, useState } from 'react';
import {
  Carrier,
  Location,
  TransportMode,
  User,
  UserRole,
} from '../types/cargotrace';
import { ModeIconChip } from './CargoTraceUI';
import { X, AlertCircle, CheckCircle2, Plus } from 'lucide-react';

interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  carriers: Carrier[];
  locations: Location[];
  customers: User[];
  onCreateShipment: (payload: {
    mode: TransportMode;
    customer_id: number;
    carrier_id: number;
    origin_location_id: number;
    destination_location_id: number;
    vehicle_ref: string;
    cargo_type: string;
    total_weight_kg: number;
    total_volume_cbm: number;
    expected_departure: string;
    expected_arrival: string;
  }) => { valid: boolean; status_code: number; message: string; errors: Record<string, string[]> };
}

export const NewShipmentModal: React.FC<NewShipmentModalProps> = ({
  isOpen,
  onClose,
  carriers,
  locations,
  customers,
  onCreateShipment,
}) => {
  const [mode, setMode] = useState<TransportMode>(TransportMode.SEA);
  const [customerId, setCustomerId] = useState<number>(customers[0]?.id || 4);
  const [carrierId, setCarrierId] = useState<number>(1);
  const [originId, setOriginId] = useState<number>(1); // IDTPP Seaport
  const [destinationId, setDestinationId] = useState<number>(5); // NLRTM Seaport
  const [vehicleRef, setVehicleRef] = useState('MV Java Horizon · Voy 512W');
  const [cargoType, setCargoType] = useState('Industrial Electrical Switchgear');
  const [weightKg, setWeightKg] = useState<number>(28500);
  const [volumeCbm, setVolumeCbm] = useState<number>(84);
  const [expectedDep, setExpectedDep] = useState('2026-11-06T08:00');
  const [expectedArr, setExpectedArr] = useState('2026-11-24T16:00');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleModePreset = (newMode: TransportMode) => {
    setMode(newMode);
    setValidationError(null);
    setFieldErrors({});
    if (newMode === TransportMode.SEA) {
      setCarrierId(1);
      setOriginId(1);
      setDestinationId(5);
      setVehicleRef('MV Java Horizon · Voy 512W');
    } else if (newMode === TransportMode.AIR) {
      setCarrierId(3);
      setOriginId(7); // CGK
      setDestinationId(9); // AMS
      setVehicleRef('Flight ST-850 · Boeing 777F');
    } else {
      setCarrierId(5);
      setOriginId(11); // IDCKG Depot
      setDestinationId(13); // IDSLO Depot
      setVehicleRef('B 9501 UXT · Mercedes Actros HGV Class 1');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setFieldErrors({});

    const depIso = expectedDep.endsWith('Z') ? expectedDep : `${expectedDep}:00Z`;
    const arrIso = expectedArr.endsWith('Z') ? expectedArr : `${expectedArr}:00Z`;

    const res = onCreateShipment({
      mode,
      customer_id: Number(customerId),
      carrier_id: Number(carrierId),
      origin_location_id: Number(originId),
      destination_location_id: Number(destinationId),
      vehicle_ref: vehicleRef,
      cargo_type: cargoType,
      total_weight_kg: Number(weightKg),
      total_volume_cbm: Number(volumeCbm),
      expected_departure: depIso,
      expected_arrival: arrIso,
    });

    if (!res.valid) {
      setValidationError(`HTTP ${res.status_code} Validation Error: ${res.message}`);
      setFieldErrors(res.errors);
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#072D59]/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-label="Create new multimodal shipment"
    >
      <div className="bg-white border border-[#E3E9F3] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F4F7FB] border-b border-[#E3E9F3] flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-[#072D59]">
              Create Multimodal Shipment
            </h2>
            <p className="text-[12.5px] text-[#475569]">
              Register a sea, air, or overland waybill with origin and destination hub validation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new shipment modal"
            className="p-1.5 rounded-lg text-[#6B7A93] hover:text-[#072D59] hover:bg-[#DBF2FC]/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-[12.5px]">
          {validationError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#FFF0F3] border border-[#FD6E88] text-[#9F1D35] space-y-1"
            >
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#FD6E88]" />
                <span>{validationError}</span>
              </div>
              {Object.entries(fieldErrors).map(([field, msgs]) => (
                <div key={field} className="text-[11.5px] pl-5">
                  • <strong>{field}:</strong> {msgs.join(' ')}
                </div>
              ))}
            </div>
          )}

          {/* Transport Mode Selector */}
          <div>
            <label className="block text-[11.5px] font-semibold text-[#072D59] mb-1.5">
              1. Select Primary Transport Mode (Option A)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[TransportMode.SEA, TransportMode.AIR, TransportMode.ROAD].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModePreset(m)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    mode === m
                      ? 'bg-[#DBF2FC]/60 border-[#072D59] ring-1 ring-[#072D59]'
                      : 'bg-white border-[#E3E9F3] hover:bg-[#F4F7FB]'
                  }`}
                >
                  <ModeIconChip mode={m} size="sm" />
                  <div>
                    <div className="font-bold text-[#072D59] text-[12.5px]">{m}</div>
                    <div className="text-[10.5px] text-[#6B7A93]">
                      {m === TransportMode.SEA
                        ? 'Seaport → Seaport'
                        : m === TransportMode.AIR
                        ? 'Airport → Airport'
                        : 'Depot / Intermodal'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="new-shipment-customer"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Customer Account
              </label>
              <select
                id="new-shipment-customer"
                value={customerId}
                onChange={(e) => setCustomerId(Number(e.target.value))}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px]"
              >
                {customers
                  .filter((u) => u.role === UserRole.CUSTOMER)
                  .map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.company_name} ({cust.name})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-shipment-carrier"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Carrier Operator (Must match {mode})
              </label>
              <select
                id="new-shipment-carrier"
                value={carrierId}
                onChange={(e) => setCarrierId(Number(e.target.value))}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px]"
              >
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.mode}] {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-shipment-origin"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Origin Location
              </label>
              <select
                id="new-shipment-origin"
                value={originId}
                onChange={(e) => setOriginId(Number(e.target.value))}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    [{l.type}] {l.name} ({l.code} · {l.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-shipment-destination"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Destination Location
              </label>
              <select
                id="new-shipment-destination"
                value={destinationId}
                onChange={(e) => setDestinationId(Number(e.target.value))}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    [{l.type}] {l.name} ({l.code} · {l.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-shipment-vehicle"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Vehicle Reference (Vessel / Flight / Plate)
              </label>
              <input
                id="new-shipment-vehicle"
                type="text"
                required
                value={vehicleRef}
                onChange={(e) => setVehicleRef(e.target.value)}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px]"
              />
            </div>

            <div>
              <label
                htmlFor="new-shipment-cargo"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Cargo Type & Commodity Description
              </label>
              <input
                id="new-shipment-cargo"
                type="text"
                required
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px]"
              />
            </div>

            <div>
              <label
                htmlFor="new-shipment-weight"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Total Gross Weight (kg)
              </label>
              <input
                id="new-shipment-weight"
                type="number"
                min={1}
                required
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px] font-mono-tabular"
              />
            </div>

            <div>
              <label
                htmlFor="new-shipment-volume"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Total Volume (CBM)
              </label>
              <input
                id="new-shipment-volume"
                type="number"
                min={1}
                required
                value={volumeCbm}
                onChange={(e) => setVolumeCbm(Number(e.target.value))}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px] font-mono-tabular"
              />
            </div>

            <div>
              <label
                htmlFor="new-shipment-dep"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Expected Departure (UTC)
              </label>
              <input
                id="new-shipment-dep"
                type="datetime-local"
                required
                value={expectedDep}
                onChange={(e) => setExpectedDep(e.target.value)}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px] font-mono-tabular"
              />
            </div>

            <div>
              <label
                htmlFor="new-shipment-arr"
                className="block text-[11.5px] font-semibold text-[#243350] mb-1"
              >
                Expected Arrival (UTC)
              </label>
              <input
                id="new-shipment-arr"
                type="datetime-local"
                required
                value={expectedArr}
                onChange={(e) => setExpectedArr(e.target.value)}
                className="w-full bg-white border border-[#E3E9F3] rounded-lg px-3 py-2 text-[12.5px] font-mono-tabular"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E3E9F3] flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-[#475569]">
              New shipments start in <strong>Created</strong> status.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-[#E3E9F3] text-[#243350] text-[12.5px] font-medium hover:bg-[#F4F7FB]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#072D59] text-white text-[12.5px] font-semibold hover:bg-[#051F3E] inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Shipment</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
