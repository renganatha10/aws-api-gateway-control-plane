export interface ConsumerItem {
  id: number;
  name: string;
  productId: number;
  environmentId: number;
  planId: number;
  clientId: string | null;
  awsApiKeyId: string | null;
  tokenUrl: string | null;
  createdBy: string;
  createdAt: Date | string;
  updatedBy: string | null;
  updatedAt: Date | string;
}

export interface ConsumerDetailItem extends ConsumerItem {
  productName: string;
  environmentName: string;
  planName: string;
}

export interface ProductOption {
  id: number;
  displayName: string;
}

export interface EnvironmentOption {
  id: number;
  name: string;
}

export interface PlanOption {
  id: number;
  displayName: string;
}
