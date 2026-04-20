import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DeployWebAppStack } from "../lib/deploy-web-app-stack";
import { ProductServiceStack } from "../lib/product-service/product-service-stack";

const app = new cdk.App();
new DeployWebAppStack(app, "DeployWebAppStack", {});
new ProductServiceStack(app, "ProductServiceStack", {});
