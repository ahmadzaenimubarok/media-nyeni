import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

export const handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    
    const { filename, contentType, folder: rawFolder } = body;
    // Remove leading/trailing slashes and trim
    const folder = (rawFolder || "").trim().replace(/^\/+|\/+$/g, "");
    
    // If folder is empty, we still want to put it in a default or root
    const pathPrefix = folder ? `${folder}/` : "";
    const key = `uploads/${pathPrefix}${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn: 60,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        url,
        key,
      }),
    };
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};