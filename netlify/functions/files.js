import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from "@aws-sdk/client-s3";
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
    let folder = event.queryStringParameters?.folder || "";
    // Ensure folder ends with / if not empty
    if (folder && !folder.endsWith("/")) folder += "/";
    
    const prefix = `uploads/${folder}`;
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: prefix,
      Delimiter: "/",
    });

    const res = await client.send(command);
    
    // 1. Process Folders (CommonPrefixes)
    const folders = (res.CommonPrefixes || []).map(p => {
        // Extract the folder name from the full prefix
        // e.g. uploads/folder/subfolder/ -> subfolder
        const parts = p.Prefix.split('/');
        return parts[parts.length - 2]; 
    });

    // 2. Process Files (Contents)
    const files = await Promise.all(
      (res.Contents || [])
        .filter(file => file.Key !== prefix) // Filter out the directory itself if it's a dummy object
        .map(async (file) => {
          const getCommand = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: file.Key,
          });

          const url = await getSignedUrl(client, getCommand, {
            expiresIn: 3600,
          });

          return {
            key: file.Key,
            name: file.Key.split('/').pop(),
            size: file.Size,
            url,
          };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        currentFolder: folder,
        folders,
        files,
      }),
    };
  } catch (err) {
    console.error("ERROR LIST:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};