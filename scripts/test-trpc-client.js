// Use exact same tRPC client setup as the app
const { createTRPCClient, httpBatchLink, httpLink } = require('@trpc/client');
const superjson = require('superjson');

const API_URL = 'https://soulwallet-production.up.railway.app';

async function testWithTrpcClient() {
    console.log('Testing with @trpc/client...\n');

    const timestamp = Date.now();
    const testUser = {
        username: 'testuser' + timestamp,
        email: `test${timestamp}@example.com`,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
    };

    console.log('Test user:', testUser.username, testUser.email);

    // Create a simple tRPC client (type-unsafe but works for testing)
    const client = createTRPCClient({
        links: [
            httpLink({
                url: `${API_URL}/api/v1/trpc`,
                transformer: superjson,
                headers: () => ({
                    'x-mobile-app-version': '1.0.0',
                }),
            }),
        ],
    });

    try {
        console.log('\nCalling auth.signup...');
        const result = await client.auth.signup.mutate(testUser);
        console.log('✅ SUCCESS!');
        console.log('Result:', result);
    } catch (error) {
        console.log('❌ ERROR:', error.message);
        if (error.data) {
            console.log('Error data:', JSON.stringify(error.data, null, 2));
        }
        if (error.shape) {
            console.log('Error shape:', JSON.stringify(error.shape, null, 2));
        }
    }

    // Check database
    console.log('\n--- Checking database ---');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: 'postgresql://postgres:NSmehsGsWCGrcgLUnLUnBMpohkxPWgcp@mainline.proxy.rlwy.net:43995/railway'
            }
        }
    });

    try {
        const users = await prisma.user.findMany({ take: 5 });
        console.log('Users in database:', users.length);
        users.forEach(u => console.log('- ', u.email));
    } catch (error) {
        console.error('DB Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testWithTrpcClient();
