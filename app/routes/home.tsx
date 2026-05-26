import { Globe, Package, Zap } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ApiGateway — Dashboard" },
    { name: "description", content: "API Gateway management dashboard" },
  ];
}

const stats = [
  { label: "Total APIs", value: "128", delta: "+4 this week" },
  { label: "Active Endpoints", value: "2,048", delta: "+12 today" },
  { label: "Avg Latency", value: "38ms", delta: "-2ms vs last wk" },
  { label: "Uptime", value: "99.98%", delta: "Last 30 days" },
];

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
    <div className="flex flex-col">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 px-6 py-12 sm:px-10">
        {/* Dot grid overlay */}
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,oklch(0.8_0_0)_1px,transparent_1px)] [background-size:24px_24px]" />
        {/* Large decorative icon */}
        <div className="absolute -right-8 -top-8 opacity-10">
          <Zap className="size-64 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <Badge variant="secondary" className="mb-4 font-mono text-xs">
            v2.4.0
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            API Gateway Dashboard
          </h1>
          <p className="mt-3 text-stone-400 sm:text-lg">
            Monitor, manage, and scale your API infrastructure from one place.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-1">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.delta}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Access */}
        <div>
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
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
    </div>
  );
}
