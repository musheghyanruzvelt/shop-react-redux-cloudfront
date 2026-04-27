import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

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
  console.log("getProductsList request:", JSON.stringify(event));
  try {
    const [productsRes, stocksRes] = await Promise.all([
      docClient.send(new ScanCommand({ TableName: PRODUCTS_TABLE })),
      docClient.send(new ScanCommand({ TableName: STOCKS_TABLE })),
    ]);

    const products = productsRes.Items ?? [];
    const stocks = stocksRes.Items ?? [];

    const joined = products.map((p) => {
      const stock = stocks.find((s) => s.product_id === p.id);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        count: stock ? stock.count : 0,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(joined),
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