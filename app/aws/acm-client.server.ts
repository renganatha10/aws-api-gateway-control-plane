import { ACMClient } from "@aws-sdk/client-acm"

export function createAcmClient(region: string): ACMClient {
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!accessKeyId)      throw new Error("AWS_ACCESS_KEY_ID is not set")
  if (!secretAccessKey)  throw new Error("AWS_SECRET_ACCESS_KEY is not set")

  return new ACMClient({ region, credentials: { accessKeyId, secretAccessKey } })
}
