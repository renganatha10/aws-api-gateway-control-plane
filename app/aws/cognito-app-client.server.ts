import {
  CreateUserPoolClientCommand,
  DescribeUserPoolClientCommand,
} from "@aws-sdk/client-cognito-identity-provider"

import { cognitoClient } from "./cognito-client.server"

/** Creates a machine-to-machine app client for the client credentials OAuth2 flow. */
export async function createMachineClient(
  userPoolId: string,
  clientName: string,
  allowedScopes: string[],
): Promise<{ clientId: string }> {
  const result = await cognitoClient.send(
    new CreateUserPoolClientCommand({
      UserPoolId:                    userPoolId,
      ClientName:                    clientName,
      GenerateSecret:                true,
      ExplicitAuthFlows:             [],
      AllowedOAuthFlows:             ["client_credentials"],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthScopes:            allowedScopes,
    }),
  )
  const clientId = result.UserPoolClient?.ClientId
  if (!clientId) throw new Error("CreateUserPoolClient returned no ClientId")
  console.log("[aws:cognito] app client created", { clientId, clientName })
  return { clientId }
}

/** Retrieves the client secret for a Cognito app client. Never stored in DB. */
export async function getClientSecret(
  userPoolId: string,
  clientId: string,
): Promise<string> {
  const result = await cognitoClient.send(
    new DescribeUserPoolClientCommand({ UserPoolId: userPoolId, ClientId: clientId }),
  )
  const secret = result.UserPoolClient?.ClientSecret
  if (!secret) throw new Error("Client has no secret")
  return secret
}
