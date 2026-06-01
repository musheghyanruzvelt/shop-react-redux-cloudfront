import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";

export class CartServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "CartServiceVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: "Allow access to RDS PostgreSQL",
      allowAllOutbound: true,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      "LambdaSecurityGroup",
      {
        vpc,
        description: "Lambda security group",
        allowAllOutbound: true,
      },
    );

    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow Lambda access to PostgreSQL",
    );

    const dbName = "cartdb";
    const dbUsername = "postgres";

    const dbCredentials = rds.Credentials.fromGeneratedSecret(dbUsername, {
      secretName: "cart-service/db-credentials",
    });

    const dbInstance = new rds.DatabaseInstance(this, "CartDatabase", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: {
        // Use ISOLATED for security; if you have no NAT and need
        // migrations from local you may temporarily use PUBLIC
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      credentials: dbCredentials,
      databaseName: dbName,
      allocatedStorage: 20,
      maxAllocatedStorage: 30,
      multiAz: false,
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only
      deletionProtection: false, // For dev only
      backupRetention: cdk.Duration.days(0), // Dev only
    });
    const dbSecret = dbInstance.secret!;

    const cartLambda = new lambdaNodejs.NodejsFunction(this, "CartLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,

      entry: path.join(
        __dirname,
        "../../../../nodejs-aws-cart-api/src/main-lambda.ts",
      ),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_PORT: dbInstance.dbInstanceEndpointPort,
        DB_NAME: dbName,
        DB_USERNAME: dbUsername,
        DB_PASSWORD: dbSecret.secretValueFromJson("password").unsafeUnwrap(),
        DEPLOY_VERSION: Date.now().toString(),
        NODE_ENV: "production",
      },
      bundling: {
        externalModules: [
          "@nestjs/microservices",
          "@nestjs/websockets",
          "class-transformer",
          "class-validator",
          "cache-manager",
        ],
      },
    });

    dbInstance.secret?.grantRead(cartLambda);

    const api = new apigateway.RestApi(this, "CartServiceApi", {
      restApiName: "Cart Service",
      description: "This service serves a NestJS Cart application.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["*"],
      },
    });

    const integration = new apigateway.LambdaIntegration(cartLambda);

    api.root.addProxy({
      defaultIntegration: integration,
      anyMethod: true,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: dbInstance.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, "DbSecretArn", {
      value: dbInstance.secret?.secretArn ?? "N/A",
    });
  }
}
