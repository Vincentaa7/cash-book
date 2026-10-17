// prisma/migrate-multi-family.js
// Migrasi aman tanpa menghapus data lama (Zero Data Loss) untuk TiDB Cloud / MySQL
// Mengikat seluruh member, transaksi, budget, snapshot, dan log yang ada ke Family #1 (id = '1')

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()

function generateSecureInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let p1 = '', p2 = ''
  const bytes = crypto.randomBytes(8)
  for (let i = 0; i < 4; i++) p1 += chars[bytes[i] % chars.length]
  for (let i = 4; i < 8; i++) p2 += chars[bytes[i] % chars.length]
  return `CB-${p1}-${p2}`
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}'`
  )
  return rows.length > 0
}

async function indexExists(tableName, indexName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`
  )
  return rows.length > 0
}

async function main() {
  console.log('🚀 Memulai migrasi Multi-Family (Zero Data Loss) untuk TiDB Cloud...\n')

  // 1. app_settings: tambah invite_code (pisahkan ADD COLUMN dan CREATE UNIQUE INDEX untuk TiDB)
  if (!(await columnExists('app_settings', 'invite_code'))) {
    console.log('➕ Menambahkan kolom invite_code ke app_settings...')
    await prisma.$executeRawUnsafe(`ALTER TABLE app_settings ADD COLUMN invite_code VARCHAR(50) NULL`)
  }
  if (!(await indexExists('app_settings', 'app_settings_invite_code_key'))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX app_settings_invite_code_key ON app_settings(invite_code)`)
  }

  // Pastikan baris id = '1' ada di app_settings dan memiliki invite_code
  const existingSettings = await prisma.$queryRawUnsafe(`SELECT id, invite_code FROM app_settings WHERE id = '1'`)
  if (existingSettings.length === 0) {
    const code = generateSecureInviteCode()
    await prisma.$executeRawUnsafe(
      `INSERT INTO app_settings (id, family_name, invite_code, theme, updated_at) VALUES ('1', 'Cash Book', '${code}', 'light', NOW(3))`
    )
    console.log(`✅ Family '1' dibuat dengan invite_code: ${code}`)
  } else if (!existingSettings[0].invite_code) {
    const code = generateSecureInviteCode()
    await prisma.$executeRawUnsafe(`UPDATE app_settings SET invite_code = '${code}' WHERE id = '1'`)
    console.log(`✅ Family '1' dilengkapi invite_code: ${code}`)
  }

  // 2. members: tambah family_id, email, email_verified
  if (!(await columnExists('members', 'family_id'))) {
    console.log('➕ Menambahkan kolom family_id ke members...')
    await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN family_id CHAR(36) NOT NULL DEFAULT '1'`)
  }
  if (!(await indexExists('members', 'members_family_id_idx'))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX members_family_id_idx ON members(family_id)`)
  }

  if (!(await columnExists('members', 'email'))) {
    console.log('➕ Menambahkan kolom email ke members...')
    await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN email VARCHAR(191) NULL`)
  }
  if (!(await indexExists('members', 'members_email_key'))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX members_email_key ON members(email)`)
  }

  if (!(await columnExists('members', 'email_verified'))) {
    console.log('➕ Menambahkan kolom email_verified ke members...')
    await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE`)
  }

  // 3. monthly_budgets: tambah family_id & perbarui unique constraint
  if (!(await columnExists('monthly_budgets', 'family_id'))) {
    console.log('➕ Menambahkan kolom family_id ke monthly_budgets...')
    await prisma.$executeRawUnsafe(`ALTER TABLE monthly_budgets ADD COLUMN family_id CHAR(36) NOT NULL DEFAULT '1'`)
  }
  if (!(await indexExists('monthly_budgets', 'monthly_budgets_family_id_idx'))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX monthly_budgets_family_id_idx ON monthly_budgets(family_id)`)
  }
  if (await indexExists('monthly_budgets', 'monthly_budgets_month_year_key')) {
    console.log('🔄 Memperbarui unique index pada monthly_budgets...')
    await prisma.$executeRawUnsafe(`ALTER TABLE monthly_budgets DROP INDEX monthly_budgets_month_year_key`)
  }
  if (!(await indexExists('monthly_budgets', 'monthly_budgets_family_id_month_year_key'))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX monthly_budgets_family_id_month_year_key ON monthly_budgets(family_id, month, year)`)
  }

  // 4. transactions: tambah family_id
  if (!(await columnExists('transactions', 'family_id'))) {
    console.log('➕ Menambahkan kolom family_id ke transactions...')
    await prisma.$executeRawUnsafe(`ALTER TABLE transactions ADD COLUMN family_id CHAR(36) NOT NULL DEFAULT '1'`)
  }
  if (!(await indexExists('transactions', 'transactions_family_id_idx'))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX transactions_family_id_idx ON transactions(family_id)`)
  }

  // 5. monthly_snapshots: tambah family_id & perbarui unique constraint
  if (!(await columnExists('monthly_snapshots', 'family_id'))) {
    console.log('➕ Menambahkan kolom family_id ke monthly_snapshots...')
    await prisma.$executeRawUnsafe(`ALTER TABLE monthly_snapshots ADD COLUMN family_id CHAR(36) NOT NULL DEFAULT '1'`)
  }
  if (!(await indexExists('monthly_snapshots', 'monthly_snapshots_family_id_idx'))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX monthly_snapshots_family_id_idx ON monthly_snapshots(family_id)`)
  }
  if (await indexExists('monthly_snapshots', 'monthly_snapshots_month_year_category_key')) {
    console.log('🔄 Memperbarui unique index pada monthly_snapshots...')
    await prisma.$executeRawUnsafe(`ALTER TABLE monthly_snapshots DROP INDEX monthly_snapshots_month_year_category_key`)
  }
  if (!(await indexExists('monthly_snapshots', 'monthly_snapshots_family_id_month_year_category_key'))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX monthly_snapshots_family_id_month_year_category_key ON monthly_snapshots(family_id, month, year, category)`)
  }

  // 6. activity_logs: tambah family_id
  if (!(await columnExists('activity_logs', 'family_id'))) {
    console.log('➕ Menambahkan kolom family_id ke activity_logs...')
    await prisma.$executeRawUnsafe(`ALTER TABLE activity_logs ADD COLUMN family_id CHAR(36) NOT NULL DEFAULT '1'`)
  }
  if (!(await indexExists('activity_logs', 'activity_logs_family_id_idx'))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX activity_logs_family_id_idx ON activity_logs(family_id)`)
  }

  // 7. email_verifications: buat tabel baru
  console.log('➕ Memastikan tabel email_verifications tersedia...')
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id CHAR(36) NOT NULL,
      email VARCHAR(191) NOT NULL,
      username VARCHAR(100) NOT NULL,
      pin_hash VARCHAR(255) NOT NULL,
      family_name VARCHAR(100) NOT NULL,
      avatar_color VARCHAR(20) NULL,
      otp_hash VARCHAR(255) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX email_verifications_email_key (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  console.log('\n🎉 Migrasi Multi-Family selesai dengan aman! Seluruh data lama tetap utuh di Family #1.')
}

main()
  .catch(err => {
    console.error('❌ Migrasi gagal:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
