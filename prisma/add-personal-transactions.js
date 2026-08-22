// prisma/add-personal-transactions.js
// Script migrasi manual untuk membuat tabel personal_transactions

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  try {
    // Cek apakah tabel sudah ada
    const tables = await p.$queryRaw`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'personal_transactions'
    `
    
    if (tables.length > 0) {
      console.log('✅ Tabel personal_transactions sudah ada, skip.')
      return
    }

    // Buat tabel baru
    await p.$executeRaw`
      CREATE TABLE personal_transactions (
        id           CHAR(36)     NOT NULL DEFAULT (UUID()),
        member_id    CHAR(36)     NOT NULL,
        item_name    VARCHAR(255) NOT NULL,
        amount       BIGINT       NOT NULL,
        type         VARCHAR(10)  NOT NULL DEFAULT 'expense',
        category     VARCHAR(100) NOT NULL,
        date         DATE         NOT NULL,
        notes        TEXT,
        created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at   DATETIME(3)  ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_pt_member (member_id),
        INDEX idx_pt_date   (date),
        CONSTRAINT fk_pt_member FOREIGN KEY (member_id) REFERENCES members(id)
      )
    `
    
    console.log('✅ Tabel personal_transactions berhasil dibuat!')
  } catch (err) {
    console.error('❌ Error migrasi:', err.message)
    throw err
  }
}

main().catch(console.error).finally(() => p.$disconnect())
