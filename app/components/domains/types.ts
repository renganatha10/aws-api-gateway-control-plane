export type MappingEntry = { key: number; apiId: string; stage: string; basePath: string }

export type SyncedApi = {
  id: number
  displayName: string
  awsApiId: string | null
}

export type DomainItem = {
  domainName: string
  endpointType: string
  awsDomainName: string | null
  certificateArn: string
  godaddyDomain: string | null
  createdAt: Date | string
}
