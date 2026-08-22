// prisma/add-personal-budgets.js
// Script migrasi untuk membuat tabel personal_budgets

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  try {
    const tables = await p.$queryRaw`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'personal_budgets'
    `
    
    if (tables.length > 0) {
      console.log('✅ Tabel personal_budgets sudah ada, skip.')
      return
    }

    await p.$executeRaw`
      CREATE TABLE personal_budgets (
        id           CHAR(36)     NOT NULL DEFAULT (UUID()),
        member_id    CHAR(36)     NOT NULL,
        month        INT          NOT NULL,
        year         INT          NOT NULL,
        amount       BIGINT       NOT NULL,
        created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at   DATETIME(3)  ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_personal_budget (member_id, month, year),
        INDEX idx_pb_member (member_id),
        CONSTRAINT fk_pb_member FOREIGN KEY (member_id) REFERENCES members(id)
      )
    `
    
    console.log('✅ Tabel personal_budgets berhasil dibuat!')
  } catch (err) {
    console.error('❌ Error migrasi personal_budgets:', err.message)
    throw err
  }
}

main().catch(console.error).finally(() => p.$disconnect())
