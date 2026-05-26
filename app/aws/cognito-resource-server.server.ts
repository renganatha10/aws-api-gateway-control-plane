import {
  CreateResourceServerCommand,
  DescribeResourceServerCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { cognitoClient } from "./cognito-client.server";

/**
 * Creates a Cognito resource server for the given identifier if one does not
 * already exist. The full OAuth scope clients use is `{identifier}/{scopeName}`.
 */
export async function ensureResourceServer(
  userPoolId: string,
  identifier: string,
  name: string,
  scopeNames: string[]
): Promise<void> {
  try {
    await cognitoClient.send(
      new DescribeResourceServerCommand({ UserPoolId: userPoolId, Identifier: identifier })
    );
    console.log("[aws:cognito] resource server exists", { identifier });
    return;
  } catch (err: unknown) {
    const errName = (err as { name?: string }).name ?? "";
    if (errName !== "ResourceNotFoundException") throw err;
  }

  await cognitoClient.send(
    new CreateResourceServerCommand({
      UserPoolId: userPoolId,
      Identifier: identifier,
      Name: name,
      Scopes: scopeNames.map((s) => ({ ScopeName: s, ScopeDescription: s })),
    })
  );
  console.log("[aws:cognito] resource server created", { identifier, scopes: scopeNames });
}
