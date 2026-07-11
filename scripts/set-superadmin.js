const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetName = 'vincentbocah@gmail.com';
  console.log(`Mencari member dengan nama: ${targetName}...`);
  
  const member = await prisma.member.findFirst({
    where: { name: targetName }
  });

  if (!member) {
    console.error(`ERROR: Member dengan nama "${targetName}" tidak ditemukan di database.`);
    process.exit(1);
  }

  console.log(`Ditemukan member: ID=${member.id}, Nama="${member.name}", Role saat ini="${member.role}"`);
  
  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { role: 'superadmin' }
  });

  console.log(`SUKSES! Member "${updated.name}" sekarang memiliki role "${updated.role}"`);
}

main()
  .catch(err => {
    console.error('Terjadi kesalahan:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
