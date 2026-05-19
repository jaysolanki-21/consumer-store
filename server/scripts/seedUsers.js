import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/db.js';

dotenv.config();

const users = [
  {
    name: 'Admin User',
    email: 'admin@store.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'Staff User 1',
    email: 'staff1@store.com',
    password: 'staff123',
    role: 'staff'
  },
  {
    name: 'Staff User 2',
    email: 'staff2@store.com',
    password: 'staff123',
    role: 'staff'
  }
];

const seedUsers = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    for (const user of users) {
      const exists = await User.findOne({ email: user.email });
      if (!exists) {
        await User.create(user);
        console.log(`✅ Created: ${user.email} (${user.role})`);
      } else {
        console.log(`⏭️  Skipped (already exists): ${user.email}`);
      }
    }

    console.log('\n🎉 Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();