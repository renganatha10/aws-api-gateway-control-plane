import { Globe, Package, Zap } from "lucide-react";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "ApiGateway — Dashboard" },
    { name: "description", content: "API Gateway management dashboard" },
  ];
}

const quickLinks = [
  { title: "APIs", icon: Zap, description: "View and manage API configurations", url: "/apis" },
  {
    title: "Environments",
    icon: Globe,
    description: "Staging, production, and dev envs",
    url: "/environments",
  },
  {
    title: "Products",
    icon: Package,
    description: "Bundle APIs into product offerings",
    url: "/products",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center px-6 py-12 gap-12 sm:px-10">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-6 max-w-2xl w-full">
        <img
          src="/connected-world.svg"
          alt="Connected world"
          className="w-full max-w-lg select-none pointer-events-none"
          draggable={false}
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            API Gateway Control Panel
          </h1>
          <p className="mt-3 text-muted-foreground sm:text-lg">
            Manage your APIs, products, environments, and consumers from one place.
          </p>
        </div>
      </div>

      {/* Quick Access */}
      <div className="w-full max-w-3xl">
        <h2 className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.title} to={link.url}>
              <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <link.icon className="size-5" />
                    </div>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
