import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

function createClient() {
  const region = process.env.AWS_REGION;
  if (!region) throw new Error("AWS_REGION is not set");
  return new CognitoIdentityProviderClient({ region });
}

declare global {
  var __cognito_idp_client__: CognitoIdentityProviderClient | undefined;
}

function getOrCreateClient(): CognitoIdentityProviderClient {
  if (process.env.NODE_ENV === "production") return createClient();
  if (!global.__cognito_idp_client__) global.__cognito_idp_client__ = createClient();
  return global.__cognito_idp_client__;
}

export const cognitoClient: CognitoIdentityProviderClient = getOrCreateClient();

export const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
