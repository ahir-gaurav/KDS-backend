const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is missing in environment variables. Database features will be unavailable.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Keep server running but with a warning
  }
};

module.exports = connectDB;
