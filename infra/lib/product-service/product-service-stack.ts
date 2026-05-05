import { Stack, StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { join } from "path";

const PRODUCTS_TABLE_NAME = "products";
const STOCKS_TABLE_NAME = "stocks";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Products table
    const productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: PRODUCTS_TABLE_NAME,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Stocks table
    const stocksTable = new dynamodb.Table(this, "StocksTable", {
      tableName: STOCKS_TABLE_NAME,
      partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const commonEnv = {
      PRODUCTS_TABLE_NAME,
      STOCKS_TABLE_NAME,
    };

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    };

    const getProductsList = new NodejsFunction(this, "getProductsList", {
      ...commonLambdaProps,
      entry: join(__dirname, "handlers/get-product-list.ts"),
      handler: "handler",
    });

    const getProductsById = new NodejsFunction(this, "getProductsById", {
      ...commonLambdaProps,
      entry: join(__dirname, "handlers/get-product-by-id.ts"),
      handler: "handler",
    });

    const createProduct = new NodejsFunction(this, "createProduct", {
      ...commonLambdaProps,
      entry: join(__dirname, "handlers/create-product.ts"),
      handler: "handler",
    });

    // Permissions
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

    // API Gateway
    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const products = api.root.addResource("products");
    products.addMethod("GET", new apigateway.LambdaIntegration(getProductsList));
    products.addMethod("POST", new apigateway.LambdaIntegration(createProduct));

    const productById = products.addResource("{productId}");
    productById.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsById)
    );
  }
}