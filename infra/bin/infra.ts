import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DeployWebAppStack } from "../lib/deploy-web-app-stack";
import { ProductServiceStack } from "../lib/product-service/product-service-stack";
import { ImportServiceStack } from "../lib/import-service/import-service-stack";
import { AuthorizationServiceStack } from "../lib/authorization-service/authorization-service-stack";
import { CartServiceStack } from "../lib/cart-service/cart-service-stack"; // ← ADD

const app = new cdk.App();

const authStack = new AuthorizationServiceStack(
  app,
  "AuthorizationServiceStack",
);

new DeployWebAppStack(app, "DeployWebAppStack", {});
new ProductServiceStack(app, "ProductServiceStack", {});
new ImportServiceStack(app, "ImportServiceStack", {
  basicAuthorizerLambda: authStack.basicAuthorizerLambda,
});

new CartServiceStack(app, "CartServiceStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
