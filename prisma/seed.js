// prisma/seed.js - Clean State for Cash Book
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Menghapus data lama...')

  // Hapus data secara urutan referensi
  await prisma.transaction.deleteMany()
  await prisma.monthlyBudget.deleteMany()
  await prisma.member.deleteMany()
  await prisma.appSettings.deleteMany()

  console.log('👤 Membuat akun Admin pertama...')
  
  // Hash PIN default: 1234
  const adminPin = await bcrypt.hash('1234', 10)

  const admin = await prisma.member.create({
    data: {
      name: 'Admin',
      role: 'admin',
      avatarColor: '#0d9488', // Green Teal
      pin: adminPin,
      isActive: true,
    },
  })

  // Inisialisasi pengaturan aplikasi
  await prisma.appSettings.create({
    data: {
      id: '1',
      familyName: 'Cash Book Keluarga',
      theme: 'light',
    },
  })

  console.log('✅ Berhasil reset database!')
  console.log('------------------------------')
  console.log('Login Akun:')
  console.log('Nama: ' + admin.name)
  console.log('PIN:  1234')
  console.log('Role: Admin')
  console.log('------------------------------')
  console.log('Silakan ganti PIN di halaman Pengaturan segera.')
}

main()
  .catch((e) => {
    console.error('❌ Error saat reset:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
