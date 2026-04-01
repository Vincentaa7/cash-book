const { PrismaClient } = require('@prisma/client')
const url = "mysql://QBL5BaDiBH4y24s.root:NfXJNpFf9hJnJn8h@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/Cluster0?sslaccept=strict"

const prisma = new PrismaClient({
  datasources: { db: { url } }
})

async function reset() {
  try {
    await prisma.appSettings.update({
      where: { id: '1' },
      data: { lastCarryOverMonth: null }
    })
    console.log('DB Reset Successful for Final Testing')
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

reset()
