import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: "us-east-1" }); // change region
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = "products";
const STOCKS_TABLE = "stocks";

const products = [
    {
        id: uuidv4(),
        title: "ZX Spectrum",
        description: "8-bit personal home computer",
        price: 150,
    },
    {
        id: uuidv4(),
        title: "Commodore 64",
        description: "Iconic home computer of the 80s",
        price: 200,
    },
    {
        id: uuidv4(),
        title: "Atari 2600",
        description: "Classic gaming console",
        price: 100,
    },
    {
        id: uuidv4(),
        title: "Game Boy",
        description: "Portable handheld console",
        price: 80,
    },
    {
        id: uuidv4(),
        title: "NES",
        description: "Nintendo Entertainment System",
        price: 120,
    },
];

const stocks = products.map((p) => ({
    product_id: p.id,
    count: Math.floor(Math.random() * 10) + 1,
}));

async function fill() {
    await docClient.send(
        new BatchWriteCommand({
            RequestItems: {
                [PRODUCTS_TABLE]: products.map((Item) => ({ PutRequest: { Item } })),
            },
        })
    );

    await docClient.send(
        new BatchWriteCommand({
            RequestItems: {
                [STOCKS_TABLE]: stocks.map((Item) => ({ PutRequest: { Item } })),
            },
        })
    );

    console.log("Tables populated");
    console.log("Products:", products);
    console.log("Stocks:", stocks);
}

fill().catch((e) => {
    console.error(e);
    process.exit(1);
});