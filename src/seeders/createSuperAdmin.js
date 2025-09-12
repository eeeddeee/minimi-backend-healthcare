import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { generateRandomPassword } from "../utils/helper.js";
import { sendEmail } from "../utils/emailService.js";
import { superAdminTemplate } from "../utils/emailTemplates.js";

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const exists = await User.findOne({ role: "super_admin" });
    if (exists) {
      console.log("Super admin already exists");
      return;
    }

    const randomPassword = generateRandomPassword();
    console.log("Generated Random Password:", randomPassword);

    // Create the super admin
    const superAdmin = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: process.env.SUPER_ADMIN_EMAIL,
      passwordHash: randomPassword,
      role: "super_admin",
      isActive: true,
      phone: "+12345678900",
      languagePreference: "en",
      street: "123 Admin Street",
      city: "Admin City",
      state: "Admin State",
      country: "Admin Country",
      postalCode: "123456",
      gender: "male",
      dateOfBirth: new Date("1980-01-01"),
      securityId: new mongoose.Types.ObjectId().toString()
    });

    console.log("Super admin created successfully!");

    // Send email
    const appUrl = process.env.APP_URL;
    const html = superAdminTemplate(
      process.env.SUPER_ADMIN_EMAIL,
      randomPassword,
      appUrl
    );

    await sendEmail({
      to: process.env.SUPER_ADMIN_EMAIL,
      subject: "Super Admin Account Credentials",
      html
    });

    console.log("Super admin created and email sent successfully");
  } catch (error) {
    console.error("Error creating super admin:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

export { createSuperAdmin };
