import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
  PolicyDocument,
} from "aws-lambda";

const generatePolicy = (
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
): APIGatewayAuthorizerResult => {
  const policyDocument: PolicyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: resource,
      },
    ],
  };

  return {
    principalId,
    policyDocument,
  };
};

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  console.log("Event:", JSON.stringify(event));

  // If no Authorization header -> we want a 401
  // For TOKEN authorizers, throwing "Unauthorized" yields a 401
  if (event.type !== "TOKEN" || !event.authorizationToken) {
    throw new Error("Unauthorized");
  }

  try {
    const authorizationToken = event.authorizationToken;
    // Expecting "Basic <base64token>"
    const tokenParts = authorizationToken.split(" ");
    const tokenType = tokenParts[0];
    const encodedCreds = tokenParts[1];

    if (tokenType !== "Basic" || !encodedCreds) {
      // Invalid header format -> Deny (403)
      return generatePolicy("user", "Deny", event.methodArn);
    }

    const buff = Buffer.from(encodedCreds, "base64");
    const plainCreds = buff.toString("utf-8").split(":");
    const username = plainCreds[0];
    const password = plainCreds[1];

    console.log(`Username: ${username}, Password: ${password}`);

    const storedPassword = process.env[username];

    const effect: "Allow" | "Deny" =
      !storedPassword || storedPassword !== password ? "Deny" : "Allow";

    return generatePolicy(username, effect, event.methodArn);
  } catch (err) {
    console.error("Error in authorizer:", err);
    throw new Error("Unauthorized");
  }
};
