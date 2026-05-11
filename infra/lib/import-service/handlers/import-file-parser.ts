import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable } from "stream";
import csvParser from "csv-parser";

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL!;

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

      const records: Record<string, string>[] = [];

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on("data", (data) => {
            records.push(data);
          })
          .on("end", () => {
            console.log(
              `Finished parsing file: ${key}. Rows count: ${records.length}`,
            );
            resolve();
          })
          .on("error", (err) => {
            console.error("CSV parsing error:", err);
            reject(err);
          });
      });

      // Send each parsed record to SQS
      for (const data of records) {
        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: SQS_QUEUE_URL,
            MessageBody: JSON.stringify(data),
          }),
        );
      }
      console.log(`Sent ${records.length} messages to SQS`);

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
