-- =============================================================================
-- CargoTrace – Global Shipment Visibility & Tracking Platform
-- MySQL 8.0+ Relational Database Schema & Seed Data (Brief Slide 11 & Slide 14)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. users (Brief Slide 5 & 11)
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(160) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'OPERATOR', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  `company_name` VARCHAR(160) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_index` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. carriers (Brief Slide 11 & Multimodal Option A)
CREATE TABLE IF NOT EXISTS `carriers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(16) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `mode` ENUM('SEA', 'AIR', 'ROAD') NOT NULL,
  `contact_email` VARCHAR(160) NOT NULL,
  `fleet_summary` VARCHAR(255) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `carriers_code_unique` (`code`),
  KEY `carriers_mode_index` (`mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. locations (Brief Slide 9 & 11)
CREATE TABLE IF NOT EXISTS `locations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(16) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `city` VARCHAR(120) NOT NULL,
  `country` VARCHAR(120) NOT NULL,
  `type` ENUM('SEAPORT', 'AIRPORT', 'DEPOT') NOT NULL,
  `latitude` DECIMAL(10, 6) NOT NULL,
  `longitude` DECIMAL(10, 6) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `locations_code_unique` (`code`),
  KEY `locations_type_index` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. shipments (Brief Slide 6, 8 & 11)
CREATE TABLE IF NOT EXISTS `shipments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shipment_number` VARCHAR(32) NOT NULL,
  `route_code` VARCHAR(24) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `carrier_id` BIGINT UNSIGNED NOT NULL,
  `mode` ENUM('SEA', 'AIR', 'ROAD') NOT NULL,
  `vehicle_ref` VARCHAR(120) NOT NULL,
  `origin_location_id` BIGINT UNSIGNED NOT NULL,
  `destination_location_id` BIGINT UNSIGNED NOT NULL,
  `cargo_type` VARCHAR(180) NOT NULL,
  `total_weight_kg` DECIMAL(12, 2) NOT NULL,
  `total_volume_cbm` DECIMAL(10, 2) NOT NULL,
  `expected_departure` DATETIME NOT NULL,
  `expected_arrival` DATETIME NOT NULL,
  `estimated_arrival` DATETIME NOT NULL,
  `actual_arrival` DATETIME NULL DEFAULT NULL,
  `status` ENUM('CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED') NOT NULL DEFAULT 'CREATED',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shipments_shipment_number_unique` (`shipment_number`),
  KEY `shipments_customer_id_foreign` (`customer_id`),
  KEY `shipments_carrier_id_foreign` (`carrier_id`),
  KEY `shipments_origin_location_id_foreign` (`origin_location_id`),
  KEY `shipments_destination_location_id_foreign` (`destination_location_id`),
  KEY `shipments_status_mode_index` (`status`, `mode`),
  CONSTRAINT `shipments_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `shipments_carrier_id_foreign` FOREIGN KEY (`carrier_id`) REFERENCES `carriers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `shipments_origin_location_id_foreign` FOREIGN KEY (`origin_location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `shipments_destination_location_id_foreign` FOREIGN KEY (`destination_location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. shipment_items (Brief Slide 11)
CREATE TABLE IF NOT EXISTS `shipment_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shipment_id` BIGINT UNSIGNED NOT NULL,
  `sku` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit` VARCHAR(32) NOT NULL,
  `weight_kg` DECIMAL(12, 2) NOT NULL,
  `volume_cbm` DECIMAL(10, 2) NOT NULL,
  `hs_code` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `shipment_items_shipment_id_foreign` (`shipment_id`),
  CONSTRAINT `shipment_items_shipment_id_foreign` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. tracking_events (Append-Only Historical Timeline - Brief Slide 7 & 11)
CREATE TABLE IF NOT EXISTS `tracking_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shipment_id` BIGINT UNSIGNED NOT NULL,
  `event_code` VARCHAR(64) NOT NULL,
  `resulting_status` ENUM('CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED') NOT NULL,
  `occurred_at` DATETIME NOT NULL,
  `location_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `location_name` VARCHAR(180) NOT NULL,
  `latitude` DECIMAL(10, 6) NOT NULL,
  `longitude` DECIMAL(10, 6) NOT NULL,
  `description` TEXT NOT NULL,
  `is_exception` TINYINT(1) NOT NULL DEFAULT 0,
  `recorded_by_user_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tracking_events_shipment_occurred_index` (`shipment_id`, `occurred_at`),
  CONSTRAINT `tracking_events_shipment_id_foreign` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tracking_events_recorded_by_foreign` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. shipment_exceptions (Brief Slide 8 & 11)
CREATE TABLE IF NOT EXISTS `shipment_exceptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shipment_id` BIGINT UNSIGNED NOT NULL,
  `exception_type` ENUM('CUSTOMS_HOLD', 'WEATHER_DELAY', 'PORT_CONGESTION', 'DAMAGED', 'MISROUTED', 'DOCUMENTATION_ISSUE') NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('OPEN', 'INVESTIGATING', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT NOT NULL,
  `detected_at` DATETIME NOT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `resolution_notes` TEXT NULL,
  `reported_by_user_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `shipment_exceptions_shipment_status_index` (`shipment_id`, `status`),
  CONSTRAINT `shipment_exceptions_shipment_id_foreign` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. notifications (Brief Slide 10 & 11)
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `shipment_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('STATUS_CHANGED', 'DELAY_DETECTED', 'EXCEPTION_RAISED', 'EXCEPTION_RESOLVED') NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `notifications_user_read_index` (`user_id`, `is_read`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_shipment_id_foreign` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. audit_logs (Brief Slide 10 & 11)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_user_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(64) NOT NULL,
  `summary` VARCHAR(255) NOT NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_actor_created_index` (`actor_user_id`, `created_at`),
  CONSTRAINT `audit_logs_actor_user_id_foreign` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. settings (Dynamic Group Delay Threshold - Brief Slide 8, 19, 20, 23)
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(64) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `settings` (`key`, `value`) VALUES
  ('group_name', 'Group A'),
  ('primary_route_focus', 'Southeast Asia -> Europe'),
  ('delay_threshold_hours', '12'),
  ('main_exception_focus', 'CUSTOMS_HOLD'),
  ('group_kpi_label', 'On-Time Delivery Rate');

SET FOREIGN_KEY_CHECKS = 1;
