const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    // Mongoose v6+ no longer needs useNewUrlParser/useUnifiedTopology options.
    // Leave options out unless you need specific connection tuning.
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wenaklabs');
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB };
