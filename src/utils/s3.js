// utils/s3.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export const uploadBufferToS3 = async ({
  buffer,
  key,
  contentType,
  bucket = process.env.AWS_S3_BUCKET
}) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "private"
    })
  );
  return { bucket, key };
};

export const buildMessageKey = (conversationId, originalName) => {
  const safeName = originalName.replace(/\s+/g, "_");
  return `messages/${conversationId}/${randomUUID()}-${safeName}`;
};

export const getSignedUrlForKey = async (
  key,
  expiresIn = 600,
  bucket = process.env.AWS_S3_BUCKET
) => {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn
  });
};
