import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import dotenv from "dotenv";


dotenv.config();

const s3 = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const randomKey = (ext = "") =>
  `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext && "." + ext}`;

export const uploadBufferToS3 = async ({
  buffer,
  mimeType,
  bucket = process.env.AWS_S3_BUCKET,
  keyPrefix = "profiles"
}) => {
  if (!buffer || !mimeType) {
    throw new Error("Invalid file buffer or mimeType");
  }

  // infer extension (best-effort)
  const ext = mimeType.split("/")[1] || "bin";
  const Key = `${keyPrefix}/${randomKey(ext)}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key,
      Body: buffer,
      ContentType: mimeType // do NOT set ACL public-read for HIPAA
    })
  );

  // store S3 key in DB; generate signed URL only when needed
  return { key: Key };
};

export const getSignedFileUrl = async ({
  key,
  bucket = process.env.AWS_S3_BUCKET,
  expiresIn = 60 * 10 // 10 minutes
}) => {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
};
