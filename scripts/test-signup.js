// Test using the TRPC client library directly (same as the app uses)
const superjson = require('superjson');

const API_URL = 'https://soulwallet-production.up.railway.app';

async function testSignup() {
    const timestamp = Date.now();
    const testUser = {
        username: 'testuser' + timestamp,
        email: `test${timestamp}@example.com`,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
    };

    console.log('Testing signup with:', {
        username: testUser.username,
        email: testUser.email
    });

    // Use superjson serialization like tRPC does
    const serialized = superjson.serialize(testUser);

    console.log('\n--- Using superjson serialization ---');
    console.log('Serialized input:', JSON.stringify(serialized, null, 2));

    try {
        const response = await fetch(`${API_URL}/api/v1/trpc/auth.signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-mobile-app-version': '1.0.0',
            },
            body: JSON.stringify(serialized)
        });

        console.log('\nStatus:', response.status);
        const data = await response.text();
        console.log('Response:', data);

        if (response.ok) {
            // Deserialize response with superjson
            try {
                const parsed = JSON.parse(data);
                const result = superjson.deserialize(parsed.result?.data);
                console.log('\n✅ SIGNUP SUCCESSFUL!');
                console.log('User:', result);
            } catch (e) {
                console.log('Could not parse response:', data);
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Now check if user was created
    console.log('\n\n--- Checking database for user ---');
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
        if (users.length > 0) {
            users.forEach(u => console.log('- ', u.email, u.username));
        }
    } catch (error) {
        console.error('DB Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testSignup();
