import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { products } from "./products";

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { productId } = event.pathParameters || {};

  if (!productId) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Product ID is required" }),
    };
  }

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return {
      statusCode: 404,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Product not found" }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(product),
  };
};
