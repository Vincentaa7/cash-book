// prisma/add-edit-tracking.js
// Script migrasi one-shot: tambahkan kolom updated_at, edited_by_id, edited_by_name ke tabel transactions
// Jalankan sekali: node prisma/add-edit-tracking.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Menambahkan kolom edit tracking ke tabel transactions...\n')

  try {
    // Cek apakah kolom sudah ada terlebih dahulu
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'transactions' 
      AND COLUMN_NAME IN ('updated_at', 'edited_by_id', 'edited_by_name')
    `

    const existingCols = columns.map(c => c.COLUMN_NAME)
    console.log('Kolom yang sudah ada:', existingCols.length > 0 ? existingCols.join(', ') : 'tidak ada')

    const toAdd = []

    if (!existingCols.includes('updated_at')) {
      toAdd.push({ name: 'updated_at', sql: `ALTER TABLE transactions ADD COLUMN updated_at DATETIME(3) NULL` })
    }
    if (!existingCols.includes('edited_by_id')) {
      toAdd.push({ name: 'edited_by_id', sql: `ALTER TABLE transactions ADD COLUMN edited_by_id CHAR(36) NULL` })
    }
    if (!existingCols.includes('edited_by_name')) {
      toAdd.push({ name: 'edited_by_name', sql: `ALTER TABLE transactions ADD COLUMN edited_by_name VARCHAR(100) NULL` })
    }

    if (toAdd.length === 0) {
      console.log('\n✅ Semua kolom sudah ada! Tidak ada yang perlu ditambahkan.')
      return
    }

    for (const col of toAdd) {
      console.log(`➕ Menambahkan kolom: ${col.name}`)
      await prisma.$executeRawUnsafe(col.sql)
      console.log(`   ✅ ${col.name} berhasil ditambahkan`)
    }

    console.log(`\n✅ Migrasi selesai! ${toAdd.length} kolom berhasil ditambahkan.`)
    console.log('📝 Kolom baru:')
    console.log('   - updated_at   : Waktu terakhir diedit (otomatis)')
    console.log('   - edited_by_id  : ID anggota yang mengedit')
    console.log('   - edited_by_name: Nama anggota saat mengedit (snapshot)')

  } catch (error) {
    console.error('\n❌ Error saat migrasi:', error.message)
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
