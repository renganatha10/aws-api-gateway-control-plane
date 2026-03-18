import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("apis", "routes/apis.tsx"),
    route("apis/:id", "routes/apis.$id.tsx"),
    route("products", "routes/products.tsx"),
    route("products/:id", "routes/products.$id.tsx"),
    route("environments", "routes/environments.tsx"),
    route("environments/:id", "routes/environments.$id.tsx"),
  ]),
] satisfies RouteConfig;
