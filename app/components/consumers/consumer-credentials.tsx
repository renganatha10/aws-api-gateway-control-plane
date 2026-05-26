import { RevealSecret } from "./reveal-secret";

interface ConsumerCredentialsProps {
  consumer: {
    id: number;
    clientId: string | null;
    tokenUrl: string | null;
    createdBy: string;
    createdAt: Date | string;
    updatedBy: string | null;
    updatedAt: Date | string;
  };
}

export function ConsumerCredentials({ consumer }: ConsumerCredentialsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      {consumer.clientId && (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">Client ID</p>
            <p className="font-mono text-sm text-gray-800 select-all" data-testid="client-id">
              {consumer.clientId}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">Client Secret</p>
            <RevealSecret consumerId={consumer.id} />
          </div>
          {consumer.tokenUrl && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Token URL</p>
              <p
                className="font-mono text-sm text-gray-800 select-all break-all"
                data-testid="token-url"
              >
                {consumer.tokenUrl}
              </p>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-gray-500">Created by</span>
          <p className="mt-0.5">{consumer.createdBy}</p>
          <p>{new Date(consumer.createdAt).toLocaleString()}</p>
        </div>
        {consumer.updatedBy && (
          <div>
            <span className="font-medium text-gray-500">Last updated by</span>
            <p className="mt-0.5">{consumer.updatedBy}</p>
            <p>{new Date(consumer.updatedAt).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
