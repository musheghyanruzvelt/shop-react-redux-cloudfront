import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csvParser from "csv-parser";

const s3Client = new S3Client({});

export const handler = async (event: S3Event): Promise<void> => {
  console.log("importFileParser event:", JSON.stringify(event));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`Processing file: s3://${bucket}/${key}`);

    try {
      const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3Client.send(getCmd);

      const stream = response.Body as Readable;

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on("data", (data) => {
            console.log("Parsed record:", JSON.stringify(data));
          })
          .on("end", () => {
            console.log(`Finished parsing file: ${key}`);
            resolve();
          })
          .on("error", (err) => {
            console.error("CSV parsing error:", err);
            reject(err);
          });
      });

      // Move file: copy to "parsed/" folder, then delete original
      const newKey = key.replace("uploaded/", "parsed/");

      await s3Client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${key}`,
          Key: newKey,
        }),
      );
      console.log(`Copied to: ${newKey}`);

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      console.log(`Deleted original: ${key}`);
    } catch (err) {
      console.error(`Error processing ${key}:`, err);
      throw err;
    }
  }
};
