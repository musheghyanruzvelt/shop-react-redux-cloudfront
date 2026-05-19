import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { join } from "path";

const PRODUCTS_TABLE_NAME = "products";
const STOCKS_TABLE_NAME = "stocks";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: PRODUCTS_TABLE_NAME,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const stocksTable = new dynamodb.Table(this, "StocksTable", {
      tableName: STOCKS_TABLE_NAME,
      partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const catalogItemsQueue = new sqs.Queue(this, "CatalogItemsQueue", {
      queueName: "catalogItemsQueue",
      visibilityTimeout: Duration.seconds(30),
    });

    const createProductTopic = new sns.Topic(this, "CreateProductTopic", {
      topicName: "createProductTopic",
    });

    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("ruzveltmusheghyan@gmail.com"),
    );

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

    // catalogBatchProcess lambda
    const catalogBatchProcess = new NodejsFunction(
      this,
      "catalogBatchProcess",
      {
        ...commonLambdaProps,
        entry: join(__dirname, "handlers/catalog-batch-process.ts"),
        handler: "handler",
        environment: {
          ...commonEnv,
          SNS_TOPIC_ARN: createProductTopic.topicArn,
        },
      },
    );

    // SQS triggers catalogBatchProcess with batches of 5
    catalogBatchProcess.addEventSource(
      new SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      }),
    );

    // Permissions
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

    productsTable.grantWriteData(catalogBatchProcess);
    stocksTable.grantWriteData(catalogBatchProcess);
    createProductTopic.grantPublish(catalogBatchProcess);

    // API Gateway
    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const products = api.root.addResource("products");
    products.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsList),
    );
    products.addMethod("POST", new apigateway.LambdaIntegration(createProduct));

    const productById = products.addResource("{productId}");
    productById.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsById),
    );

    // Outputs to share with Import Service Stack
    new CfnOutput(this, "CatalogItemsQueueUrl", {
      value: catalogItemsQueue.queueUrl,
      exportName: "CatalogItemsQueueUrl",
    });

    new CfnOutput(this, "CatalogItemsQueueArn", {
      value: catalogItemsQueue.queueArn,
      exportName: "CatalogItemsQueueArn",
    });
  }
}
