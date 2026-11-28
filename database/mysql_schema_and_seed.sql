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
  ('group_name', 'Worldwide Network'),
  ('primary_route_focus', 'Worldwide Multimodal Corridors (Asia · Europe · Americas · Middle East · Oceania)'),
  ('delay_threshold_hours', '12'),
  ('main_exception_focus', 'CUSTOMS_HOLD'),
  ('group_kpi_label', 'Global On-Time Delivery Rate');

-- Seed Users (Admin, Operator, 2 Customers)
INSERT IGNORE INTO `users` (`id`, `name`, `email`, `password`, `role`, `company_name`) VALUES
  (1, 'Rendra Wijaya', 'admin@cargotrace.id', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 'DND Atlas Worldwide HQ'),
  (2, 'Budiono Siregar', 'budisiregar@cargotrace.id', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'OPERATOR', 'DND Atlas Worldwide Operations'),
  (3, 'Siti Rahmawati', 'siti.ops@cargotrace.id', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'OPERATOR', 'DND Atlas Worldwide Operations'),
  (4, 'Hendrik Van Der Berg', 'hendrik@rotterdam-retail.nl', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', 'EuroNordic Retail BV'),
  (5, 'Kartika Kusuma', 'kartika@nusantaratech.co.id', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', 'PT Nusantara Precision Mfg');

-- Seed Multimodal Carriers (SEA, AIR, ROAD)
INSERT IGNORE INTO `carriers` (`id`, `code`, `name`, `mode`, `contact_email`, `fleet_summary`, `active`) VALUES
  (1, 'NML', 'Nusantara Maritime Lines', 'SEA', 'ops@nusantaramaritime.id', '18 Ultra-Large Container Vessels', 1),
  (2, 'EOS', 'EuroAsia Ocean Star', 'SEA', 'control@euroasiaocean.nl', '24 Panamax & Neo-Panamax Vessels', 1),
  (3, 'SAC', 'Stratos Air Cargo', 'AIR', 'dispatch@stratosair.aero', '12 Boeing 777F & 747-8F Freighters', 1),
  (4, 'AAF', 'Archipelago AeroFreight', 'AIR', 'cargo@archipelagoaero.sg', '9 Airbus A330-200F Regional Jets', 1),
  (5, 'SHE', 'Swift Haul Express', 'ROAD', 'fleet@swifthaul.co.id', '140 Heavy Wingbox & Reefer Trucks', 1),
  (6, 'TEC', 'Trans Euro Carriers', 'ROAD', 'dispatch@transeuro.de', '85 Euro-6 Articulated HGV Tractor Units', 1),
  (7, 'ARF', 'Auto Route Freight', 'ROAD', 'ops@autoroutefreight.id', '60 Intercity Container Chassis Trucks', 1);

-- Seed 29 Worldwide Locations (Asia, Europe, North America, South America, Middle East, Australia)
INSERT IGNORE INTO `locations` (`id`, `code`, `name`, `city`, `country`, `type`, `latitude`, `longitude`) VALUES
  (1, 'IDTPP', 'Port of Tanjung Priok', 'Jakarta', 'Indonesia', 'SEAPORT', -6.104500, 106.882700),
  (2, 'IDSUB', 'Port of Tanjung Perak', 'Surabaya', 'Indonesia', 'SEAPORT', -7.198600, 112.732900),
  (3, 'SGSIN', 'PSA Singapore Tuas Mega Port', 'Singapore', 'Singapore', 'SEAPORT', 1.264400, 103.822200),
  (4, 'MYPKG', 'Port Klang Westports Terminal', 'Port Klang', 'Malaysia', 'SEAPORT', 2.999800, 101.392400),
  (5, 'NLRTM', 'Port of Rotterdam Maasvlakte II', 'Rotterdam', 'Netherlands', 'SEAPORT', 51.955500, 4.132800),
  (6, 'DEHAM', 'Port of Hamburg Altenwerder', 'Hamburg', 'Germany', 'SEAPORT', 53.506700, 9.936900),
  (7, 'CGK', 'Soekarno-Hatta International Cargo Terminal', 'Jakarta', 'Indonesia', 'AIRPORT', -6.125600, 106.655800),
  (8, 'SIN', 'Changi Airfreight Centre', 'Singapore', 'Singapore', 'AIRPORT', 1.364400, 103.991500),
  (9, 'AMS', 'Amsterdam Airport Schiphol Cargo Hub', 'Amsterdam', 'Netherlands', 'AIRPORT', 52.310500, 4.768300),
  (10, 'IDCKG', 'Cikarang Dry Port & Logistics Park', 'Cikarang', 'Indonesia', 'DEPOT', -6.277500, 107.152600),
  (11, 'IDBDG', 'Bandung Gedebage Inland Distribution Hub', 'Bandung', 'Indonesia', 'DEPOT', -6.946700, 107.694800),
  (12, 'IDSLO', 'Surakarta Central Java Freight Depot', 'Surakarta', 'Indonesia', 'DEPOT', -7.556800, 110.821600),
  (13, 'NLEIN', 'Eindhoven Brainport European Road Depot', 'Eindhoven', 'Netherlands', 'DEPOT', 51.452600, 5.423100),
  (14, 'USLAX', 'Port of Los Angeles San Pedro Container Terminal', 'Los Angeles', 'United States', 'SEAPORT', 33.740500, -118.271900),
  (15, 'LAX', 'Los Angeles International Imperial Cargo Complex', 'Los Angeles', 'United States', 'AIRPORT', 33.941600, -118.408500),
  (16, 'USONT', 'Ontario Inland Empire Freight Distribution Depot', 'Ontario', 'United States', 'DEPOT', 34.056000, -117.600900),
  (17, 'HKG', 'Hong Kong International SuperTerminal 1', 'Hong Kong', 'Hong Kong SAR', 'AIRPORT', 22.308000, 113.918500),
  (18, 'AUMEL', 'Port of Melbourne Swanson Dock Terminal', 'Melbourne', 'Australia', 'SEAPORT', -37.822600, 144.913600),
  (19, 'AUSYD', 'Port Botany Container Terminal Sydney', 'Sydney', 'Australia', 'SEAPORT', -33.974600, 151.216500),
  (20, 'SYD', 'Sydney Kingsford Smith International Cargo Hub', 'Sydney', 'Australia', 'AIRPORT', -33.939900, 151.175300),
  (21, 'AUBNE', 'Eastern Creek Western Sydney Road Freight Depot', 'Sydney', 'Australia', 'DEPOT', -33.802500, 150.848900),
  (22, 'CNSHA', 'Port of Shanghai Yangshan Deepwater Terminal', 'Shanghai', 'China', 'SEAPORT', 30.626500, 122.064500),
  (23, 'JPTYO', 'Port of Tokyo Oi Container Terminal', 'Tokyo', 'Japan', 'SEAPORT', 35.619700, 139.779800),
  (24, 'AEJEA', 'Jebel Ali Port Terminal 3 Dubai', 'Dubai', 'United Arab Emirates', 'SEAPORT', 24.985700, 55.027300),
  (25, 'DXB', 'Dubai World Central Al Maktoum Cargo Hub', 'Dubai', 'United Arab Emirates', 'AIRPORT', 24.896400, 55.161400),
  (26, 'USNYC', 'Port Newark-Elizabeth Marine Terminal', 'Newark', 'United States', 'SEAPORT', 40.684000, -74.150200),
  (27, 'JFK', 'John F. Kennedy International Air Cargo Center', 'New York', 'United States', 'AIRPORT', 40.641300, -73.778100),
  (28, 'BRSSZ', 'Port of Santos Latin America Container Hub', 'Santos', 'Brazil', 'SEAPORT', -23.961800, -46.312200),
  (29, 'MEL', 'Melbourne Tullamarine International Freight Hub', 'Melbourne', 'Australia', 'AIRPORT', -37.669000, 144.841000);

SET FOREIGN_KEY_CHECKS = 1;

