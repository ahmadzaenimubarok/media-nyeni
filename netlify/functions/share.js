import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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
    // Get key from query param or directly from path
    let key = event.queryStringParameters?.key;
    
    // If key not in query, try to get it from the path (Netlify proxy)
    if (!key) {
      const pathParts = event.path.split("/view/");
      if (pathParts.length > 1) {
        key = pathParts[1];
      }
    }

    if (!key) {
      return { 
        statusCode: 400, 
        body: `Error: Missing file key. Path: ${event.path}`
      };
    }

    const decodedKey = decodeURIComponent(key);

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: decodedKey,
    });

    // Generate a fresh signed URL (valid for 1 hour)
    const url = await getSignedUrl(client, command, {
      expiresIn: 3600,
    });

    // Redirect user to the actual file
    return {
      statusCode: 302,
      headers: {
        Location: url,
        "Cache-Control": "no-cache",
      },
      body: "",
    };
  } catch (err) {
    console.error("SHARE ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
