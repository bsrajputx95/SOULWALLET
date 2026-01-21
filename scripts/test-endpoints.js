// Test various tRPC endpoints to see which work
const API_URL = 'https://soulwallet-production.up.railway.app';

async function testEndpoints() {
    const endpoints = [
        { path: '/health', method: 'GET' },
        { path: '/api/v1/trpc', method: 'GET' },
        { path: '/api/v1/trpc/auth.signup', method: 'GET' },
        { path: '/api/v1/trpc/auth.signup', method: 'POST', body: { json: { username: 'test', email: 'test@test.com', password: 'pass123', confirmPassword: 'pass123' } } },
    ];

    for (const ep of endpoints) {
        try {
            const options = {
                method: ep.method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-mobile-app-version': '1.0.0',
                }
            };

            if (ep.body) {
                options.body = JSON.stringify(ep.body);
            }

            const response = await fetch(`${API_URL}${ep.path}`, options);
            const data = await response.text();
            console.log(`${ep.method} ${ep.path}: ${response.status}`);
            console.log(`  Response: ${data.substring(0, 100)}...`);
        } catch (error) {
            console.log(`${ep.method} ${ep.path}: ERROR - ${error.message}`);
        }
        console.log();
    }
}

testEndpoints();
