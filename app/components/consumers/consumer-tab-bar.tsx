import { Link } from "react-router";

interface ConsumerTabBarProps {
  consumerId: number;
  activeTab: "details" | "tryout";
}

export function ConsumerTabBar({ consumerId, activeTab }: ConsumerTabBarProps) {
  return (
    <div className="flex border-b border-gray-200 px-6 shrink-0">
      {activeTab === "details" ? (
        <span className="border-b-2 border-gray-900 text-gray-900 px-4 pb-2 pt-2 text-sm font-medium">
          Details
        </span>
      ) : (
        <Link
          to={`/consumers/${consumerId}`}
          className="border-b-2 border-transparent text-gray-500 hover:text-gray-900 px-4 pb-2 pt-2 text-sm font-medium transition-colors"
        >
          Details
        </Link>
      )}

      {activeTab === "tryout" ? (
        <span className="border-b-2 border-gray-900 text-gray-900 px-4 pb-2 pt-2 text-sm font-medium">
          Try Out
        </span>
      ) : (
        <Link
          to={`/consumers/${consumerId}/tryout`}
          className="border-b-2 border-transparent text-gray-500 hover:text-gray-900 px-4 pb-2 pt-2 text-sm font-medium transition-colors"
        >
          Try Out
        </Link>
      )}
    </div>
  );
}
