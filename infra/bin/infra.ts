import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DeployWebAppStack } from "../lib/deploy-web-app-stack";

const app = new cdk.App();
new DeployWebAppStack(app, "DeployWebAppStack", {});
