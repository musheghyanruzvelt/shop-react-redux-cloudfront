import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizerLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Build env vars from .env (excluding system-level vars)
    const githubLogin = Object.keys(process.env).find(
      (key) => process.env[key] === "TEST_PASSWORD",
    );

    if (!githubLogin) {
      throw new Error(
        "No credentials found in .env file. Please add {githubLogin}=TEST_PASSWORD",
      );
    }

    const environment: { [key: string]: string } = {
      [githubLogin]: process.env[githubLogin] as string,
    };

    const basicAuthorizerLambda = new nodejs.NodejsFunction(
      this,
      "BasicAuthorizerLambda",
      {
        functionName: "basicAuthorizer",
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "handlers/basicAuthorizer.ts"),
        environment,
      },
    );

    this.basicAuthorizerLambda = basicAuthorizerLambda;

    // Export the Lambda ARN so other stacks can import it
    new cdk.CfnOutput(this, "BasicAuthorizerLambdaArn", {
      value: basicAuthorizerLambda.functionArn,
      exportName: "BasicAuthorizerLambdaArn",
    });

    new cdk.CfnOutput(this, "BasicAuthorizerLambdaName", {
      value: basicAuthorizerLambda.functionName,
      exportName: "BasicAuthorizerLambdaName",
    });
  }
}
