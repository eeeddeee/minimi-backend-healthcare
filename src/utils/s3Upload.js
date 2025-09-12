import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

export const uploadToS3 = async (file) => {
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${uuidv4()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read"
    };

    const uploadResult = await s3.upload(params).promise();
    return uploadResult.Location;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error("Failed to upload file to S3");
  }
};

export const deleteFromS3 = async (url) => {
  try {
    if (!url) return;

    const key = url.split("/").pop();
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error("S3 Delete Error:", error);
    throw new Error("Failed to delete file from S3");
  }
};
