const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const logCount = await p.activityLog.count();
  console.log('Activity log count:', logCount);
  
  const members = await p.member.findMany({
    select: { id: true, name: true, role: true, isActive: true }
  });
  console.log('Members:', JSON.stringify(members, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
