import multer from "multer";

const storage = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  }
}).single("profile_image");

// import multer from "multer";

// const storage = multer.memoryStorage(); // Store files in memory
// const upload = multer({ storage: storage });

// export default upload;

// // import multer from "multer";
// // import { StatusCodes } from "http-status-codes";

// // // Configure multer for memory storage (better for S3 uploads)
// // const storage = multer.memoryStorage();

// // // File filter for security
// // const fileFilter = (req, file, cb) => {
// //   const allowedMimeTypes = [
// //     "image/jpeg",
// //     "image/png",
// //     "image/gif",
// //     "application/pdf"
// //   ];

// //   if (allowedMimeTypes.includes(file.mimetype)) {
// //     cb(null, true);
// //   } else {
// //     cb(
// //       new ErrorResponse(
// //         StatusCodes.BAD_REQUEST,
// //         "Invalid file type. Only images (JPEG, PNG, GIF) and PDFs are allowed."
// //       ),
// //       false
// //     );
// //   }
// // };

// // // Limits for file uploads
// // const limits = {
// //   fileSize: 5 * 1024 * 1024, // 5MB
// //   files: 1
// // };

// // const upload = multer({
// //   storage,
// //   fileFilter,
// //   limits
// // });

// // export default upload;
