import { createHmac } from "node:crypto";
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  type InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET ?? "";

function secretHash(username: string): string {
  return createHmac("sha256", CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest("base64");
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface NewPasswordChallengeResult {
  challengeName: "NEW_PASSWORD_REQUIRED";
  session: string;
  email: string;
}

export interface UserProfile {
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  name: string;
}

/** USER_PASSWORD_AUTH flow — server-side direct credential exchange */
export async function loginWithCredentials(
  username: string,
  password: string
): Promise<TokenResponse | NewPasswordChallengeResult> {
  let res: InitiateAuthCommandOutput | undefined;
  try {
    res = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: secretHash(username),
        },
      })
    );
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      throw new Error("Invalid username or password");
    }
    console.error("[cognito] login failed", { username, error: String(err) });
    throw new Error("Sign in failed. Please try again.");
  }

  if (res.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    return {
      challengeName: "NEW_PASSWORD_REQUIRED",
      session: res.Session ?? "",
      email: username,
    };
  }

  const auth = res.AuthenticationResult;
  if (!auth?.IdToken) throw new Error("Invalid username or password");

  // IdToken (not AccessToken) carries profile claims (email, given_name, etc.)
  return {
    access_token: auth.IdToken,
    refresh_token: auth.RefreshToken ?? "",
    expires_in: auth.ExpiresIn ?? 3600,
    token_type: auth.TokenType ?? "Bearer",
  };
}

/** Permanently delete a user from the Cognito User Pool */
export async function deleteUser(email: string): Promise<void> {
  try {
    await client.send(
      new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: email })
    );
    console.log("[cognito] user deleted", { email });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "UserNotFoundException") return; // already gone, treat as success
    console.error("[cognito] deleteUser failed", { email, error: String(err) });
    throw new Error("Failed to delete user from Cognito.");
  }
}

/** Invite a new user via Admin API — Cognito sends temp-password email */
export async function inviteUser(params: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,
      UserAttributes: [
        { Name: "email", Value: params.email },
        { Name: "email_verified", Value: "true" },
        { Name: "given_name", Value: params.firstName ?? "" },
        { Name: "family_name", Value: params.lastName ?? "" },
      ],
    })
  );
}

/** Complete the NEW_PASSWORD_REQUIRED challenge */
export async function setNewPassword(
  email: string,
  session: string,
  newPassword: string
): Promise<TokenResponse> {
  let res;
  try {
    res = await client.send(
      new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
          SECRET_HASH: secretHash(email),
        },
      })
    );
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "InvalidPasswordException") {
      throw new Error("Password does not meet requirements (minimum 8 characters).");
    }
    console.error("[cognito] set new password failed", { email, error: String(err) });
    throw new Error("Failed to set password. Please try again.");
  }

  const auth = res.AuthenticationResult;
  if (!auth?.IdToken) throw new Error("Failed to set password. Please try again.");

  return {
    access_token: auth.IdToken,
    refresh_token: auth.RefreshToken ?? "",
    expires_in: auth.ExpiresIn ?? 3600,
    token_type: auth.TokenType ?? "Bearer",
  };
}


/** Create a confirmed user via Admin API */
export async function registerUser(params: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: params.email,
        TemporaryPassword: params.password,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: params.email },
          { Name: "email_verified", Value: "true" },
          { Name: "given_name", Value: params.firstName ?? "" },
          { Name: "family_name", Value: params.lastName ?? "" },
        ],
      })
    );
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    if (e.name === "UsernameExistsException") {
      throw new Error("An account with this email already exists");
    }
    if (e.name === "InvalidPasswordException") {
      throw new Error(e.message ?? "Password does not meet the required policy");
    }
    console.error("[cognito] register failed", { email: params.email, error: String(err) });
    throw new Error("Failed to create account");
  }

  // Confirm the user immediately so they can log in right away
  try {
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: params.email,
        Password: params.password,
        Permanent: true,
      })
    );
  } catch (err) {
    console.error("[cognito] set permanent password failed", {
      email: params.email,
      error: String(err),
    });
    throw new Error("Failed to create account");
  }
}

/** Extract the user ID from the Cognito ID token (JWT sub claim) */
export function extractUserId(accessToken: string): string {
  return decodeTokenPayload(accessToken)?.sub ?? "";
}

/** Decode user profile claims from the Cognito ID token payload */
export function getUserProfile(accessToken: string): UserProfile {
  const p = decodeTokenPayload(accessToken);
  return {
    sub: p?.sub ?? "",
    email: p?.email ?? "",
    given_name: p?.given_name ?? "",
    family_name: p?.family_name ?? "",
    name: p?.name ?? [p?.given_name, p?.family_name].filter(Boolean).join(" "),
  };
}

/**
 * Initiate Cognito's forgot-password flow — sends a 6-digit code to the user's
 * email. Always resolves silently so callers never leak whether an account exists.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    await client.send(
      new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: email,
        SecretHash: secretHash(email),
      })
    );
  } catch (err) {
    console.error("[cognito] forgot password failed", {
      email,
      error: String(err),
    });
    // swallow — never leak account existence
  }
}

/**
 * Confirm the password reset using the code emailed by Cognito.
 * Throws a user-facing error on failure.
 */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  try {
    await client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        SecretHash: secretHash(email),
      })
    );
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "CodeMismatchException" || name === "ExpiredCodeException") {
      throw new Error("Invalid or expired code. Please request a new one.");
    }
    if (name === "InvalidPasswordException") {
      throw new Error("Password does not meet requirements (minimum 8 characters).");
    }
    console.error("[cognito] confirm forgot password failed", {
      email,
      error: String(err),
    });
    throw new Error("Failed to reset password. Please try again.");
  }
}

function decodeTokenPayload(token: string): Record<string, string> | null {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as Record<
      string,
      string
    >;
  } catch {
    return null;
  }
}
