const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function checkAndFixUser() {
  try {
    const user = await db.user.findUnique({
      where: { email: 'student@eduquantica.com' },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
      },
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Password field: ${user.password ? 'HAS VALUE' : 'NULL'}`);

    if (!user.password) {
      console.log('\n⚠️  Password field is NULL. User cannot log in with credentials.');
      console.log('To fix this, we need to update the password field with the hash.');
      console.log('\nWould you like to provide the hash to update?');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
}

checkAndFixUser();
