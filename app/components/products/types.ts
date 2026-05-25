export type ProductSection = "Product setup" | "Visibility" | "APIs" | "Plans" | "Deployments"

export const PRODUCT_SECTIONS: ProductSection[] = [
  "Product setup",
  "Visibility",
  "APIs",
  "Plans",
  "Deployments",
]

export const SPEC_TYPE_LABEL: Record<string, string> = {
  swagger2: "OpenAPI 2.0",
  openapi3: "OpenAPI 3.0",
}

export interface ProductItem {
  id: number
  name: string
  displayName: string
  description: string | null
  visibility: string
}

export interface ApiItem {
  id: number
  displayName: string
  name: string
  basePath: string | null
  specType: string
}

export interface PlanItem {
  id: number
  displayName: string
  name: string
  throttle: number | null
  burst: number | null
}

export interface EnvironmentItem {
  id: number
  name: string
}

export interface DeploymentItem {
  id: number
  environmentId: number
  status: string
  invokeUrl: string | null
  createdBy: string
  createdAt: Date | string
  updatedBy: string | null
  updatedAt: Date | string
}
