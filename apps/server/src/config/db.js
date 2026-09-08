const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    // console.log(`URI: ${env.mongodbUri}`);
    
    // Don't use deprecated options
    const conn = await mongoose.connect(env.mongodbUri);
    
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    
    // Check replica set status
    try {
      const admin = conn.connection.db.admin();
      const replicaSetStatus = await admin.command({ replSetGetStatus: 1 });
      console.log(`✓ MongoDB Replica Set: ${replicaSetStatus.set} (${replicaSetStatus.members.length} members)`);
    } catch (error) {
      console.warn('⚠ Warning: MongoDB is not running as a replica set.');
      console.warn('  Change Streams (needed for realtime traces) will not work.');
      console.warn('  Fix: Ensure MongoDB is started with --replSet rs0');
    }
    
    return conn;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    console.error('  Is MongoDB running?');
    console.error('  Check: docker compose ps | grep mongo');
    process.exit(1);
  }
};

module.exports = connectDB;