import { Stack, StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { join } from "path";

export class ImportServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Bucket for CSV uploads
    const importBucket = new s3.Bucket(this, "ImportBucket", {
      bucketName: `import-service-bucket-${this.account}-${this.region}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
        },
      ],
    });

    // Create the "uploaded" folder by deploying an empty placeholder
    new s3deploy.BucketDeployment(this, "CreateUploadedFolder", {
      sources: [s3deploy.Source.data("uploaded/.keep", "")],
      destinationBucket: importBucket,
      retainOnDelete: false,
    });

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
    };

    // Lambda: importProductsFile (returns Signed URL)
    const importProductsFile = new NodejsFunction(this, "importProductsFile", {
      ...commonLambdaProps,
      entry: join(__dirname, "handlers/import-products-file.ts"),
      handler: "handler",
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        REGION: this.region,
      },
    });

    // Allow lambda to PUT objects to the bucket (needed for signed PUT URL)
    importBucket.grantPut(importProductsFile);
    importBucket.grantReadWrite(importProductsFile);

    // Lambda: importFileParser (triggered by S3 ObjectCreated events)
    const importFileParser = new NodejsFunction(this, "importFileParser", {
      ...commonLambdaProps,
      entry: join(__dirname, "handlers/import-file-parser.ts"),
      handler: "handler",
      bundling: {
        nodeModules: ["csv-parser"],
      },
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
    });

    importBucket.grantReadWrite(importFileParser);
    importBucket.grantDelete(importFileParser);

    // S3 Trigger -> importFileParser for objects in "uploaded/"
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: "uploaded/" },
    );

    // API Gateway
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["*"],
      },
    });

    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFile),
      {
        requestParameters: {
          "method.request.querystring.name": true,
        },
      },
    );
  }
}
