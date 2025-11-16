const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testOTP() {
  try {
    console.log('🔍 Checking OTP records in database...');
    
    // Get all OTP records
    const otps = await prisma.oTP.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`📊 Found ${otps.length} OTP records:`);
    
    otps.forEach((otp, index) => {
      console.log(`${index + 1}. Email: ${otp.email}`);
      console.log(`   Code: ${otp.code}`);
      console.log(`   Type: ${otp.type}`);
      console.log(`   Expires: ${otp.expiresAt}`);
      console.log(`   Used: ${otp.used}`);
      console.log(`   Created: ${otp.createdAt}`);
      console.log('');
    });
    
    // Test with the most recent OTP
    if (otps.length > 0) {
      const latestOtp = otps[0];
      console.log(`🧪 Testing with latest OTP: ${latestOtp.code}`);
      
      // Make a request to verify this OTP
      const response = await fetch('http://localhost:3001/api/trpc/auth.verifyOtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            email: latestOtp.email,
            otp: latestOtp.code
          }
        })
      });
      
      const result = await response.json();
      console.log('✅ OTP verification result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOTP();