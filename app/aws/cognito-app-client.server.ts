import {
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  DescribeUserPoolClientCommand,
  DescribeUserPoolCommand,
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

/** Deletes a Cognito app client by client ID. */
export async function deleteAppClient(
  userPoolId: string,
  clientId: string,
): Promise<void> {
  await cognitoClient.send(
    new DeleteUserPoolClientCommand({ UserPoolId: userPoolId, ClientId: clientId }),
  )
  console.log("[aws:cognito] app client deleted", { clientId })
}

/** Returns the OAuth2 token endpoint URL for the user pool's hosted domain. */
export async function getTokenUrl(userPoolId: string): Promise<string> {
  const result = await cognitoClient.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }))
  const domain = result.UserPool?.Domain
  if (!domain) throw new Error("Cognito User Pool has no hosted UI domain configured")
  const region = process.env.AWS_REGION!
  return `https://${domain}.auth.${region}.amazoncognito.com/oauth2/token`
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
