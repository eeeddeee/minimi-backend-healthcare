export const superAdminTemplate = (email, password, appUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Super Admin Account Created</h2>
    <p>Your Super Admin account has been successfully created.</p>

    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
    </div>

    <p>Please login and change your password immediately:</p>
    <a href="${appUrl}/login"
       style="display: inline-block; padding: 10px 20px; background-color: #3498db;
              color: white; text-decoration: none; border-radius: 5px;">
      Login to System
    </a>

    <div style="margin-top: 20px; padding: 15px; background-color: #fff8e1; border-left: 4px solid #ffc107;">
      <h4 style="margin-top: 0; color: #ff9800;">Important Security Information</h4>
      <ul style="padding-left: 20px;">
        <li>This is a one-time password - change it immediately after login</li>
        <li>Never share your credentials with anyone</li>
        <li>Our support team will never ask for your password</li>
      </ul>
    </div>

    <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
      <strong>Note:</strong> This is an automated message. Please do not reply to this email.
    </p>
  </div>
`;

const baseTemplate = (email, password, role, appUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">${role.charAt(0).toUpperCase() + role.slice(1)} Account Created</h2>
    <p>Your ${role} account has been successfully created.</p>

    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
    </div>

    <p>Please login and change your password immediately:</p>
    <a href="${appUrl}/login"
       style="display: inline-block; padding: 10px 20px; background-color: #3498db;
              color: white; text-decoration: none; border-radius: 5px;">
      Login to System
    </a>

    <div style="margin-top: 20px; padding: 15px; background-color: #fff8e1; border-left: 4px solid #ffc107;">
      <h4 style="margin-top: 0; color: #ff9800;">Important Security Information</h4>
      <ul style="padding-left: 20px;">
        <li>This is a one-time password - change it immediately after login</li>
        <li>Never share your credentials with anyone</li>
        <li>Our support team will never ask for your password</li>
      </ul>
    </div>

    <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
      <strong>Note:</strong> This is an automated message. Please do not reply to this email.
    </p>
  </div>
`;

// export const superAdminTemplate = (email, password, appUrl) =>
//   baseTemplate(email, password, "super admin", appUrl);

export const hospitalAdminTemplate = (email, password, appUrl) =>
  baseTemplate(email, password, "hospital admin", appUrl);

export const nurseTemplate = (email, password, appUrl) =>
  baseTemplate(email, password, "nurse", appUrl);

export const caregiverTemplate = (email, password, appUrl) =>
  baseTemplate(email, password, "caregiver", appUrl);

export const familyMemberTemplate = (email, password, appUrl) =>
  baseTemplate(email, password, "family member", appUrl);

export const patientTemplate = (email, password, appUrl) =>
  baseTemplate(email, password, "patient", appUrl);

export const resetPasswordTemplate = (resetUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Password Reset Request</h2>
    <p>We received a request to reset your Minimi Healthcare System account password.</p>

    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}"
         style="display: inline-block; padding: 10px 20px; background-color: #3498db;
                color: white; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p style="margin-top: 10px; font-size: 13px;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #7f8c8d; word-break: break-all;">${resetUrl}</span>
      </p>
    </div>

    <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>

    <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
      <strong>Security Note:</strong> 
      <ul style="margin-top: 5px; padding-left: 20px; font-size: 12px; color: #7f8c8d;">
        <li>This link expires in 15 minutes</li>
        <li>Never share your password with anyone</li>
        <li>Our team will never ask for your password</li>
      </ul>
    </p>
  </div>
`;

export const accountCredentialsTemplate = (email, password, role, loginUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
    <h2 style="color: #2c3e50;">Welcome to Healthcare Portal</h2>
    <p>Your ${role} account has been created successfully.</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
    </div>
    
    <p>Please login using the button below and change your password immediately:</p>
    
    <a href="${loginUrl}" 
       style="display: inline-block; padding: 10px 20px; background-color: #3498db; 
              color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
      Login to Portal
    </a>
    
    <p style="font-size: 12px; color: #7f8c8d;">
      <strong>Note:</strong> This is an automated message. Please do not reply to this email.
    </p>
  </div>
`;

// export const resetPasswordTemplate = (resetUrl) => `
//   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//     <h2 style="color: #2c3e50;">Password Reset Request</h2>
//     <p>You requested a password reset. Click the button below to reset your password:</p>

//     <a href="${resetUrl}"
//        style="display: inline-block; padding: 10px 20px; background-color: #3498db;
//               color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
//       Reset Password
//     </a>

//     <p>If you didn't request this, please ignore this email.</p>

//     <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
//       <strong>Note:</strong> This link will expire in 15 minutes.
//     </p>
//   </div>
// `;

// // export const accountCredentialsTemplateForHospitalFacility = (
// //   email,
// //   loginUrl
// // ) => `
// //   <div style="background: #fafafa; padding: 40px 0;">
// //     <div style="max-width: 600px; background: #fff; margin: 40px auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); padding: 40px 30px; font-family: Arial, Helvetica, sans-serif;">
// //       <h2 style="text-align: center; font-weight: bold; color: #222; margin-bottom: 24px;">
// //         Welcome to Minimi Health Portal - Hospital Facility<br>Account Setup
// //       </h2>
// //       <p style="font-weight: 600; margin-bottom: 18px; text-align: center;">
// //         Kindly click the link below to access your account and complete the setup:
// //       </p>
// //       <div style="text-align: center;">
// //         <a href="${loginUrl}" style="background: #8ad35c; color: #fff; display: inline-block; padding: 14px 0; width: 100%; border-radius: 3px; font-size: 16px; font-weight: 500; text-decoration: none;">
// //           LOGIN NOW
// //         </a>
// //       </div>
// //     </div>
// //   </div>
// // `;

// export const accountCredentialsTemplateForHospitalFacility = (
//   email,
//   password,
//   role,
//   loginUrl
// ) => `
//   <div style="background: #fafafa; padding: 40px 0;">
//     <div style="max-width: 600px; background: #fff; margin: 40px auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); padding: 40px 30px; font-family: Arial, Helvetica, sans-serif;">
//       <h2 style="text-align: center; font-weight: bold; color: #222; margin-bottom: 24px;">
//         Welcome to Minimi Health Portal - Hospital Facility<br>Account Setup
//       </h2>
//       <p style="font-weight: 600; margin-bottom: 18px; text-align: center;">
//         Kindly find your login credentials for the ${role} facility account below:
//       </p>
//       <p style="text-align: center; margin-bottom: 10px;">
//         Email: <a href="mailto:${email}" style="color: #2471ec; text-decoration: underline;">${email}</a>
//       </p>
//       <p style="text-align: center; margin-bottom: 18px;">
//         Password: <span style="font-weight: 600;">${password}</span>
//       </p>
//       <p style="text-align: center; margin-bottom: 30px;">
//         Click the button below to access your ${role} facility account and complete the setup.
//       </p>
//       <div style="text-align: center;">
//         <a href="${loginUrl}" style="background: #8ad35c; color: #fff; display: inline-block; padding: 14px 0; width: 100%; border-radius: 3px; font-size: 16px; font-weight: 500; text-decoration: none;">
//           CLICK TO LOGIN
//         </a>
//       </div>
//     </div>
//   </div>
// `;

// export const resetPasswordTemplate = (resetUrl) => `
//   <div style="width: 100%; text-align: center;">
//     <div style="max-width: 500px; margin: 40px auto; background: #fff;">
//       <h2 style="color: #4B004B;">Welcome To Seat Reservation Account Settings</h2>
//       <p>Hi</p>
//       <p>Your Reset Password link for seat reservation account is:</p>
//       <a href="${resetUrl}" style="background: #8ad35c; color: #fff; display: inline-block; padding: 14px 0; width: 100%; border-radius: 3px; font-size: 16px; font-weight: 500; text-decoration: none; margin-top: 18px;">
//         RESET YOUR PASSWORD
//       </a>
//     </div>
//   </div>
// `;
