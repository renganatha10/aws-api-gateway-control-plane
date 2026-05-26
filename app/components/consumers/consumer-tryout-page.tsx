import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { ConsumerTabBar } from "./consumer-tab-bar";
import { RequestBuilderSection } from "./request-builder-section";
import { TryoutCredentialsSection } from "./tryout-credentials-section";

interface ProductApi {
  id: number;
  displayName: string;
  spec: unknown;
}

interface TryoutConsumer {
  id: number;
  name: string;
  productId: number;
  environmentId: number;
  clientId: string | null;
  tokenUrl: string | null;
  productName: string;
  environmentName: string;
  planName: string;
}

interface ConsumerTryoutPageProps {
  consumer: TryoutConsumer;
  productApis: ProductApi[];
  invokeUrl: string | null;
}

export function ConsumerTryoutPage({ consumer, productApis, invokeUrl }: ConsumerTryoutPageProps) {
  const [token, setToken] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const apiKeyValue = consumer.clientId ?? "";

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-6 pt-4 text-sm text-muted-foreground shrink-0">
        <Link to="/consumers" className="hover:underline">
          Consumers
        </Link>
        {" /"}
      </div>

      <div className="flex items-center justify-between px-6 pt-1 pb-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FlaskConical className="size-5 text-blue-600 shrink-0" />
          <h1 className="text-2xl font-semibold text-gray-900 truncate">{consumer.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            {consumer.productName}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs bg-purple-50 text-purple-700 border-purple-200"
          >
            {consumer.environmentName}
          </Badge>
          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
            {consumer.planName}
          </Badge>
        </div>
      </div>

      <ConsumerTabBar consumerId={consumer.id} activeTab="tryout" />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          {!invokeUrl && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              This product has not been deployed to the consumer's stage yet. Publish the product
              first.
            </div>
          )}

          <TryoutCredentialsSection
            consumerId={consumer.id}
            tokenUrl={consumer.tokenUrl}
            token={token}
            tokenVisible={tokenVisible}
            apiKeyValue={apiKeyValue}
            apiKeyVisible={apiKeyVisible}
            onTokenChange={setToken}
            onTokenVisibleToggle={() => setTokenVisible((v) => !v)}
            onApiKeyVisibleToggle={() => setApiKeyVisible((v) => !v)}
          />

          <RequestBuilderSection
            consumerId={consumer.id}
            productApis={productApis}
            invokeUrl={invokeUrl}
            token={token}
            apiKeyValue={apiKeyValue}
          />
        </div>
      </div>
    </div>
  );
}
