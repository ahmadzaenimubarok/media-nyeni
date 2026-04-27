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
    const search = event.queryStringParameters?.q || "";
    const isGlobal = event.queryStringParameters?.isGlobal === "true";

    // Ensure folder ends with / if not empty
    if (folder && !folder.endsWith("/")) folder += "/";
    
    const prefix = `uploads/${folder}`;
    
    // For search, we might want to list recursively (no delimiter)
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: search && isGlobal ? "uploads/" : prefix,
      Delimiter: search ? undefined : "/", 
    });

    const res = await client.send(command);
    
    let folders = [];
    let files = [];

    if (search) {
      // Recursive Search Mode
      const searchLower = search.toLowerCase();
      
      // Extract unique folders that match search
      const matchedFoldersSet = new Set();
      (res.Contents || []).forEach(obj => {
          const keyParts = obj.Key.replace("uploads/", "").split("/");
          keyParts.forEach((part, idx) => {
              // If it's a directory part and matches search
              if (idx < keyParts.length - 1 && part.toLowerCase().includes(searchLower)) {
                  matchedFoldersSet.add(keyParts.slice(0, idx + 1).join("/") + "/");
              }
          });
      });
      folders = Array.from(matchedFoldersSet).slice(0, 20);

      // Extract files that match search
      const matchedFiles = (res.Contents || [])
        .filter(obj => {
          const fileName = obj.Key.split("/").pop();
          return fileName.toLowerCase().includes(searchLower) && !obj.Key.endsWith("/");
        })
        .slice(0, 50);

      files = await Promise.all(
        matchedFiles.map(async (file) => {
          const getCommand = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: file.Key,
          });

          const url = await getSignedUrl(client, getCommand, { expiresIn: 3600 });

          return {
            key: file.Key,
            name: file.Key.split('/').pop(),
            fullPath: file.Key.replace("uploads/", ""),
            size: file.Size,
            url,
          };
        })
      );
    } else {
      // Normal Listing Mode
      folders = (res.CommonPrefixes || []).map(p => {
          const parts = p.Prefix.split('/');
          return parts[parts.length - 2]; 
      });

      files = await Promise.all(
        (res.Contents || [])
          .filter(file => file.Key !== prefix && !file.Key.endsWith("/"))
          .map(async (file) => {
            const getCommand = new GetObjectCommand({
              Bucket: process.env.R2_BUCKET,
              Key: file.Key,
            });

            const url = await getSignedUrl(client, getCommand, { expiresIn: 3600 });

            return {
              key: file.Key,
              name: file.Key.split('/').pop(),
              size: file.Size,
              url,
            };
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        currentFolder: folder,
        folders,
        files,
        isSearch: !!search,
        isGlobal
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