import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

function createClient() {
  const region = process.env.AWS_REGION;
  if (!region) throw new Error("AWS_REGION is not set");
  return new CognitoIdentityProviderClient({ region });
}

declare global {
  var __cognito_idp_client__: CognitoIdentityProviderClient | undefined;
}

export const cognitoClient: CognitoIdentityProviderClient =
  process.env.NODE_ENV === "production"
    ? createClient()
    : (global.__cognito_idp_client__ ??= createClient());

export const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
