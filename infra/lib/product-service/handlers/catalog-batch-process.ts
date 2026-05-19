import { SQSEvent, SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({});

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME!;
const STOCKS_TABLE_NAME = process.env.STOCKS_TABLE_NAME!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log("catalogBatchProcess invoked:", JSON.stringify(event));

  const createdProducts: any[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const { title, description, price, count } = body;

      if (!title || price === undefined || price === null) {
        console.error("Invalid product data, skipping:", body);
        continue;
      }

      const productId = randomUUID();
      const numericPrice = Number(price);
      const numericCount = Number(count ?? 0);

      if (Number.isNaN(numericPrice)) {
        console.error("Invalid price, skipping:", body);
        continue;
      }

      const product = {
        id: productId,
        title: String(title),
        description: String(description ?? ""),
        price: numericPrice,
      };

      const stock = {
        product_id: productId,
        count: numericCount,
      };

      await docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: PRODUCTS_TABLE_NAME, Item: product } },
            { Put: { TableName: STOCKS_TABLE_NAME, Item: stock } },
          ],
        }),
      );

      createdProducts.push({ ...product, count: numericCount });
      console.log("Created product:", product);
    } catch (err) {
      console.error("Error processing record:", record, err);
    }
  }

  if (createdProducts.length > 0) {
    // Send a separate SNS message per product so that filter policy on `price`
    // works for each product individually.
    await Promise.all(
      createdProducts.map((product) =>
        snsClient.send(
          new PublishCommand({
            TopicArn: SNS_TOPIC_ARN,
            Subject: "New product created",
            Message: JSON.stringify({
              message: "New product was created",
              product,
            }),
            MessageAttributes: {
              price: {
                DataType: "Number",
                StringValue: String(product.price),
              },
            },
          }),
        ),
      ),
    );

    console.log(`Published ${createdProducts.length} SNS notifications`);
  }
};
