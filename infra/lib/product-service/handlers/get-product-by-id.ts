import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME!;
const STOCKS_TABLE = process.env.STOCKS_TABLE_NAME!;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("getProductsById request:", JSON.stringify(event));
  try {
    const productId = event.pathParameters?.productId;
    if (!productId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "productId is required" }),
      };
    }

    const [productRes, stockRes] = await Promise.all([
      docClient.send(
        new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id: productId } })
      ),
      docClient.send(
        new GetCommand({
          TableName: STOCKS_TABLE,
          Key: { product_id: productId },
        })
      ),
    ]);

    if (!productRes.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    const product = {
      id: productRes.Item.id,
      title: productRes.Item.title,
      description: productRes.Item.description,
      price: productRes.Item.price,
      count: stockRes.Item ? stockRes.Item.count : 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product),
    };
  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};