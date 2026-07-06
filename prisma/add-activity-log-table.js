// prisma/add-activity-log-table.js
// Script migrasi one-shot: membuat tabel activity_logs di database
// Jalankan sekali: node prisma/add-activity-log-table.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Membuat tabel activity_logs di database...\n')

  try {
    // Jalankan CREATE TABLE secara langsung melalui query SQL mentah
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id CHAR(36) NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        details TEXT NULL,
        member_id CHAR(36) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_member_id (member_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
    await prisma.$executeRawUnsafe(createTableSql)
    console.log('✅ Tabel activity_logs berhasil dibuat!')

  } catch (error) {
    console.error('❌ Error saat membuat tabel:', error.message)
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
