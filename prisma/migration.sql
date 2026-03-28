-- ============================================================
-- Cash Book - Migration SQL Script
-- Jalankan script ini di TiDB Cloud SQL Editor
-- ============================================================

-- Tabel anggota keluarga
CREATE TABLE IF NOT EXISTS members (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  role         VARCHAR(10)  NOT NULL DEFAULT 'member',
  avatar_color VARCHAR(20),
  pin          VARCHAR(255) NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabel kas bulanan
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id         CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  month      INT      NOT NULL,
  year       INT      NOT NULL,
  amount     BIGINT   NOT NULL,
  created_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_month_year (month, year),
  FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL
);

-- Tabel transaksi pengeluaran
CREATE TABLE IF NOT EXISTS transactions (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  item_name        VARCHAR(255) NOT NULL,
  amount           BIGINT       NOT NULL,
  category         VARCHAR(100) NOT NULL,
  transaction_date DATE         NOT NULL,
  notes            TEXT,
  member_id        CHAR(36),
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
);

-- Tabel pengaturan aplikasi
CREATE TABLE IF NOT EXISTS app_settings (
  id          CHAR(36)     NOT NULL DEFAULT '1' PRIMARY KEY,
  family_name VARCHAR(100) NOT NULL DEFAULT 'Cash Book',
  theme       VARCHAR(10)  NOT NULL DEFAULT 'light',
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT IGNORE INTO app_settings (id, family_name, theme) VALUES ('1', 'Cash Book', 'light');
