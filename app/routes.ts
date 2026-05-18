import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("api/gateway-switch", "routes/api.gateway-switch.ts"),
  route("forgot-password", "routes/forgot-password.tsx"),
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
  ]),
] satisfies RouteConfig;
