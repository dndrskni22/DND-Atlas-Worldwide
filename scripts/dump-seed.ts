import {
  ALL_SEED_SHIPMENTS,
  INITIAL_GROUP_SETTINGS,
  SEED_AUDIT_LOGS,
  SEED_CARRIERS,
  SEED_EXCEPTIONS,
  SEED_LOCATIONS,
  SEED_NOTIFICATIONS,
  SEED_SHIPMENT_ITEMS,
  SEED_TRACKING_EVENTS,
  SEED_USERS,
} from "../src/data/seedCargoTrace.ts";
import { mkdirSync, writeFileSync } from "node:fs";

const data = {
  groupSettings: INITIAL_GROUP_SETTINGS,
  users: SEED_USERS,
  locations: SEED_LOCATIONS,
  carriers: SEED_CARRIERS,
  shipments: ALL_SEED_SHIPMENTS,
  items: SEED_SHIPMENT_ITEMS,
  events: SEED_TRACKING_EVENTS,
  exceptions: SEED_EXCEPTIONS,
  notifications: SEED_NOTIFICATIONS,
  auditLogs: SEED_AUDIT_LOGS,
};
mkdirSync("database/seeders/data", { recursive: true });
writeFileSync("database/seeders/data/seed.json", JSON.stringify(data, null, 2));
console.log(JSON.stringify({
  users: data.users.length,
  locations: data.locations.length,
  carriers: data.carriers.length,
  shipments: data.shipments.length,
  items: data.items.length,
  events: data.events.length,
  exceptions: data.exceptions.length,
  notifications: data.notifications.length,
  auditLogs: data.auditLogs.length,
}));
