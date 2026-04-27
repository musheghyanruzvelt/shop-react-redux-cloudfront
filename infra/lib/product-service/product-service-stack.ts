import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { aws_apigateway, aws_lambda } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const handlersPath = "lib/product-service/handlers";

    const sharedLambdaProps = {
      runtime: aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: { minify: true, sourceMap: true },
    };

    const getProductsList = new NodejsFunction(this, "getProductsList", {
      ...sharedLambdaProps,
      entry: `${handlersPath}/get-product-list.ts`,
      handler: "handler",
      functionName: "getProductsList",
      description: "Returns a full list of products",
    });

    const getProductsById = new NodejsFunction(this, "getProductsById", {
      ...sharedLambdaProps,
      entry: `${handlersPath}/get-product-by-id.ts`,
      handler: "handler",
      functionName: "getProductsById",
      description: "Returns a single product by productId",
    });

    const api = new aws_apigateway.RestApi(this, "ProductServiceApi", {
      restApiName: "Product Service",
      deployOptions: { stageName: "prod" },
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    });

    const productsResource = api.root.addResource("products");
    productsResource.addMethod(
      "GET",
      new aws_apigateway.LambdaIntegration(getProductsList),
    );

    productsResource
      .addResource("{productId}")
      .addMethod("GET", new aws_apigateway.LambdaIntegration(getProductsById));

    new CfnOutput(this, "ProductServiceApiUrl", {
      value: api.url,
    });
  }
}
