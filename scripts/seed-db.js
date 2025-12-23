
import { seed } from '../server/seed.js';
import prisma from '../server/db.js';

async function main() {
    console.log('🌱 Starting database seeding...');
    await seed();
    console.log('✅ Seeding completed.');
    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
});
