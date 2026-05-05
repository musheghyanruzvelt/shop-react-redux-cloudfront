import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = process.env.BUCKET_NAME!;
const REGION = process.env.REGION || "us-east-1";

const s3Client = new S3Client({ region: REGION });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("importProductsFile event:", JSON.stringify(event));

  try {
    const fileName = event.queryStringParameters?.name;

    if (!fileName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Query parameter 'name' is required" }),
      };
    }

    if (!fileName.toLowerCase().endsWith(".csv")) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Only .csv files are allowed" }),
      };
    }

    const key = `uploaded/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: "text/csv",
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60,
    });

    console.log("Generated signed URL:", signedUrl);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(signedUrl),
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
