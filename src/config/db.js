import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const database = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(database, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(
      `✅ MongoDB connected to: ${conn.connection.db.databaseName} on host ${conn.connection.host}`
    );
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
    process.exit(1);
  }
};

export default connectDB;
