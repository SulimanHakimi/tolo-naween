import mongoose from 'mongoose';

// Serverless functions are recycled constantly, so the connection is cached on the
// global object. Without this each invocation would open a new pool and exhaust the
// database's connection limit.
let cached = global._toloMongoose;
if (!cached) cached = global._toloMongoose = { conn: null, promise: null };

export default async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { dbName: process.env.MONGODB_DB || 'tolo_naween', bufferCommands: false })
      .catch((err) => {
        cached.promise = null;                       // let the next request retry
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
