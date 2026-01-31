
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://neondb_owner:npg_bHwR8YS7Eemq@ep-hidden-sun-acjvsssl.sa-east-1.aws.neon.tech/neondb?sslmode=require",
        },
    },
})

async function main() {
    const device = await prisma.device.findFirst({
        where: { name: 'RP4' },
        include: {
            defaultPlaylist: true,
            schedule: {
                include: {
                    items: {
                        include: { playlist: true }
                    }
                }
            }
        }
    })

    console.log(JSON.stringify(device, null, 2))
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
