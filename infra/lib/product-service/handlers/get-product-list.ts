import { APIGatewayProxyResult } from "aws-lambda";
import { products } from "./products";

export const handler = async (): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(products),
  };
};
