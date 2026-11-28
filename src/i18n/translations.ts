import {
  ExceptionStatus,
  ExceptionType,
  LocationType,
  ModeEventType,
  SeverityLevel,
  ShipmentStatus,
  TransportMode,
  UserRole,
} from '../types/cargotrace';

export type Language = 'id' | 'en';

export function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem('cargotrace_lang');
    if (saved === 'en' || saved === 'id') return saved;
  } catch {
    // ignore storage errors
  }
  return 'id'; // Default to Bahasa Indonesia so the user immediately understands everything
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem('cargotrace_lang', lang);
  } catch {
    // ignore storage errors
  }
}

export function translateMode(mode: TransportMode, lang: Language): string {
  if (lang === 'id') {
    if (mode === TransportMode.SEA) return 'Kargo Laut';
    if (mode === TransportMode.AIR) return 'Kargo Udara';
    return 'Kargo Darat';
  }
  if (mode === TransportMode.SEA) return 'Sea Freight';
  if (mode === TransportMode.AIR) return 'Air Freight';
  return 'Road Freight';
}

export function translateModeShort(mode: TransportMode, lang: Language): string {
  if (lang === 'id') {
    if (mode === TransportMode.SEA) return 'Laut';
    if (mode === TransportMode.AIR) return 'Udara';
    return 'Darat';
  }
  if (mode === TransportMode.SEA) return 'Sea';
  if (mode === TransportMode.AIR) return 'Air';
  return 'Road';
}

export function translateModeCorridorLabel(mode: TransportMode, lang: Language): string {
  if (lang === 'id') {
    if (mode === TransportMode.SEA) return 'Pelabuhan ke Pelabuhan';
    if (mode === TransportMode.AIR) return 'Udara Ekspres';
    return 'Darat ke Hub';
  }
  if (mode === TransportMode.SEA) return 'Sea To Port';
  if (mode === TransportMode.AIR) return 'Air Express';
  return 'Road To Hub';
}

export function translateLocationType(type: LocationType, lang: Language): string {
  if (lang === 'id') {
    if (type === LocationType.SEAPORT) return 'Pelabuhan Laut';
    if (type === LocationType.AIRPORT) return 'Bandara Kargo';
    return 'Depo Darat';
  }
  if (type === LocationType.SEAPORT) return 'Seaport';
  if (type === LocationType.AIRPORT) return 'Airport';
  return 'Road Depot';
}

export function translateShipmentStatus(status: ShipmentStatus, lang: Language): string {
  if (lang === 'id') {
    switch (status) {
      case ShipmentStatus.CREATED:
        return 'Dibuat';
      case ShipmentStatus.BOOKED:
        return 'Dipesan';
      case ShipmentStatus.PICKED_UP:
        return 'Diambil';
      case ShipmentStatus.IN_TRANSIT:
        return 'Dalam Perjalanan';
      case ShipmentStatus.DELIVERED:
        return 'Terkirim';
    }
  }
  switch (status) {
    case ShipmentStatus.CREATED:
      return 'Created';
    case ShipmentStatus.BOOKED:
      return 'Booked';
    case ShipmentStatus.PICKED_UP:
      return 'Picked Up';
    case ShipmentStatus.IN_TRANSIT:
      return 'In Transit';
    case ShipmentStatus.DELIVERED:
      return 'Delivered';
  }
}

export function translateSeverity(severity: SeverityLevel, lang: Language): string {
  if (lang === 'id') {
    switch (severity) {
      case SeverityLevel.NONE:
        return 'Tepat Jadwal';
      case SeverityLevel.LOW:
        return 'Terlambat Ringan (0–6j)';
      case SeverityLevel.MEDIUM:
        return 'Terlambat Sedang (6–24j)';
      case SeverityLevel.HIGH:
        return 'Terlambat Parah (>24j)';
    }
  }
  switch (severity) {
    case SeverityLevel.NONE:
      return 'On schedule';
    case SeverityLevel.LOW:
      return 'Minor delay (0–6h)';
    case SeverityLevel.MEDIUM:
      return 'Moderate delay (6–24h)';
    case SeverityLevel.HIGH:
      return 'Severe delay (>24h)';
  }
}

export function translateExceptionStatus(status: ExceptionStatus, lang: Language): string {
  if (lang === 'id') {
    switch (status) {
      case ExceptionStatus.OPEN:
        return 'Tertahan (Terbuka)';
      case ExceptionStatus.INVESTIGATING:
        return 'Sedang Ditinjau';
      case ExceptionStatus.RESOLVED:
        return 'Selesai Diatasi';
    }
  }
  switch (status) {
    case ExceptionStatus.OPEN:
      return 'Open Hold';
    case ExceptionStatus.INVESTIGATING:
      return 'Under Review';
    case ExceptionStatus.RESOLVED:
      return 'Resolved';
  }
}

export function translateExceptionType(type: ExceptionType, lang: Language): string {
  if (lang === 'id') {
    switch (type) {
      case ExceptionType.CUSTOMS_HOLD:
        return 'Tertahan Bea Cukai';
      case ExceptionType.WEATHER_DELAY:
        return 'Kendala Cuaca Buruk';
      case ExceptionType.PORT_CONGESTION:
        return 'Kepadatan Pelabuhan';
      case ExceptionType.DOCUMENTATION_ISSUE:
        return 'Masalah Dokumen';
      case ExceptionType.DAMAGED:
        return 'Kerusakan Kargo';
      case ExceptionType.MISROUTED:
        return 'Salah Rute';
    }
  }
  switch (type) {
    case ExceptionType.CUSTOMS_HOLD:
      return 'Customs Hold';
    case ExceptionType.WEATHER_DELAY:
      return 'Weather Delay';
    case ExceptionType.PORT_CONGESTION:
      return 'Port Congestion';
    case ExceptionType.DOCUMENTATION_ISSUE:
      return 'Documentation Issue';
    case ExceptionType.DAMAGED:
      return 'Cargo Damaged';
    case ExceptionType.MISROUTED:
      return 'Misrouted';
  }
}

export function translateRole(role: UserRole, lang: Language): string {
  if (lang === 'id') {
    switch (role) {
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.OPERATOR:
        return 'Operator';
      case UserRole.CUSTOMER:
        return 'Pelanggan';
    }
  }
  switch (role) {
    case UserRole.ADMIN:
      return 'Admin';
    case UserRole.OPERATOR:
      return 'Operator';
    case UserRole.CUSTOMER:
      return 'Customer';
  }
}

export function translateEventType(ev: ModeEventType | string, lang: Language): string {
  if (lang === 'id') {
    const map: Record<string, string> = {
      STATUS_CHANGE: 'Perubahan Status',
      VESSEL_LOADED: 'Dimuat ke Kapal',
      VESSEL_DEPARTED: 'Kapal Berangkat',
      TRANSSHIPMENT_ARRIVED: 'Tiba di Pelabuhan Transit',
      PORT_ARRIVED: 'Tiba di Pelabuhan Tujuan',
      CUSTOMS_HOLD: 'Tertahan Pemeriksaan Bea Cukai',
      CUSTOMS_CLEARED: 'Lolos Pemeriksaan Bea Cukai',
      FLIGHT_BOOKED: 'Jadwal Penerbangan Dipesan',
      CARGO_ACCEPTED: 'Kargo Diterima di Gudang Bandara',
      FLIGHT_DEPARTED: 'Pesawat Kargo Lepas Landas',
      FLIGHT_LANDED: 'Pesawat Kargo Mendarat',
      DEPOT_DISPATCHED: 'Truk Berangkat dari Depo',
      DEPARTED_DEPOT: 'Truk Keluar dari Depo Asal',
      CHECKPOINT_PASSED: 'Melewati Titik Pemeriksaan',
      ARRIVED_HUB: 'Tiba di Depo Tujuan',
      OUT_FOR_DELIVERY: 'Dalam Pengantaran Akhir',
      POD_SIGNED: 'Bukti Serah Terima Ditandatangani',
      LOCATION_UPDATE: 'Pembaruan Titik Lokasi',
      EXCEPTION_REPORTED: 'Kendala Dilaporkan',
      EXCEPTION_RESOLVED: 'Kendala Diselesaikan',
    };
    return map[ev] || ev.replace(/_/g, ' ');
  }
  return ev
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function translateAuditAction(action: string, lang: Language): string {
  if (lang === 'id') {
    const map: Record<string, string> = {
      GROUP_CONFIG_INITIALIZED: 'Konfigurasi Sistem Diinisialisasi',
      EXCEPTION_LOGGED: 'Kendala Dicatat',
      EXCEPTION_OPENED: 'Kendala Dibuka',
      EXCEPTION_RESOLVED: 'Kendala Diselesaikan',
      STATUS_TRANSITION: 'Perubahan Status Pengiriman',
      TRACKING_EVENT_ADDED: 'Riwayat Pelacakan Ditambahkan',
      SHIPMENT_CREATED: 'Pengiriman Baru Dibuat',
      THRESHOLD_UPDATED: 'Batas Waktu SLA Diperbarui',
      LOCATION_CREATED: 'Lokasi Hub Ditambahkan',
      LOCATION_DELETED: 'Lokasi Hub Dihapus',
    };
    return map[action] || action.replace(/_/g, ' ');
  }
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
