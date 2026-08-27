const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const cur = await p.monthlyBudget.findUnique({
    where: { uq_month_year: { month: 8, year: 2026 } }
  });
  if (!cur) { console.log("Budget Agustus 2026 tidak ditemukan!"); return; }
  
  console.log("Sebelum: Rp " + Number(cur.amount).toLocaleString("id-ID"));
  
  const updated = await p.monthlyBudget.update({
    where: { uq_month_year: { month: 8, year: 2026 } },
    data: { amount: BigInt(18618000) }
  });
  
  console.log("Sesudah: Rp " + Number(updated.amount).toLocaleString("id-ID"));
  console.log("Koreksi berhasil!");
}

main().catch(console.error).finally(() => p.$disconnect());
