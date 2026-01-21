const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:NSmehsGsWCGrcgLUnLUnBMpohkxPWgcp@mainline.proxy.rlwy.net:43995/railway'
        }
    }
});

async function main() {
    try {
        // Check if User table exists and has data
        const users = await prisma.user.findMany({
            take: 10,
            select: {
                id: true,
                email: true,
                username: true,
                createdAt: true,
                password: true
            }
        });

        console.log('=== USERS IN DATABASE ===');
        console.log('Total found:', users.length);

        users.forEach((u, i) => {
            console.log(`\nUser ${i + 1}:`);
            console.log('  ID:', u.id);
            console.log('  Email:', u.email);
            console.log('  Username:', u.username);
            console.log('  Created:', u.createdAt);
            console.log('  Password hash starts with:', u.password?.substring(0, 15) + '...');
        });

        // Check for specific user
        const specificUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: 'bhavani.sb.rajput@gmail.com' },
                    { username: { contains: 'bhavani', mode: 'insensitive' } }
                ]
            }
        });

        console.log('\n=== SPECIFIC USER SEARCH ===');
        if (specificUser) {
            console.log('Found user:', specificUser.email, specificUser.username);
        } else {
            console.log('User bhavani.sb.rajput@gmail.com NOT FOUND in database!');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
