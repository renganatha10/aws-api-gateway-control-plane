import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("api/gateway-switch", "routes/api.gateway-switch.ts"),
  route("api/consumer-secret/:id", "routes/api.consumer-secret.$id.ts"),
  route("api/consumer-apikey/:id", "routes/api.consumer-apikey.$id.ts"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("gateway", "routes/gateway.tsx"),
    route("apis", "routes/apis.tsx"),
    route("apis/new", "routes/api-create.tsx"),
    route("apis/:id", "routes/apis.$id.tsx"),
    route("products", "routes/products.tsx"),
    route("products/new", "routes/product-create.tsx"),
    route("products/:id", "routes/products.$id.tsx"),
    route("environments", "routes/environments.tsx"),
    route("environments/:id", "routes/environments.$id.tsx"),
    route("plans", "routes/plans.tsx"),
    route("consumers", "routes/consumers.tsx"),
    route("consumers/new", "routes/consumer-create.tsx"),
    route("consumers/:id", "routes/consumers.$id.tsx"),
  ]),
] satisfies RouteConfig;
