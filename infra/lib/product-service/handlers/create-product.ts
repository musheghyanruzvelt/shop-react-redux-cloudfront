import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

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
    console.log("createProduct request:", JSON.stringify(event));
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Request body is required" }),
            };
        }

        const body = JSON.parse(event.body);
        const { title, description, price, count } = body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof price !== "number" ||
            price < 0 ||
            typeof count !== "number" ||
            count < 0
        ) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Invalid product data" }),
            };
        }

        const id = uuidv4();

        await docClient.send(
            new TransactWriteCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: PRODUCTS_TABLE,
                            Item: {
                                id,
                                title,
                                description: description ?? "",
                                price,
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: STOCKS_TABLE,
                            Item: {
                                product_id: id,
                                count,
                            },
                        },
                    },
                ],
            })
        );

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ id, title, description, price, count }),
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