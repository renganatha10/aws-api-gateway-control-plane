import { APIGatewayClient } from "@aws-sdk/client-api-gateway";

function createClient() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region) throw new Error("AWS_REGION is not set");
  if (!accessKeyId) throw new Error("AWS_ACCESS_KEY_ID is not set");
  if (!secretAccessKey) throw new Error("AWS_SECRET_ACCESS_KEY is not set");

  return new APIGatewayClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

declare global {
  var __aws_apigw_client__: APIGatewayClient | undefined;
}

function getOrCreateClient(): APIGatewayClient {
  if (process.env.NODE_ENV === "production") return createClient();
  if (!global.__aws_apigw_client__) global.__aws_apigw_client__ = createClient();
  return global.__aws_apigw_client__;
}

export const apigwClient: APIGatewayClient = getOrCreateClient();
