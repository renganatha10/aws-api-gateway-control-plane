import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { ServerError } from "~/components/server-error";
import { Toaster } from "~/components/ui/sonner";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-white px-4">
          <h1 className="text-6xl font-bold text-gray-200">404</h1>
          <p className="text-gray-500">The page you're looking for doesn't exist.</p>
        </main>
      );
    }
    return (
      <ServerError
        title={`Error ${error.status}`}
        message={error.statusText || "An unexpected server error occurred."}
      />
    );
  }

  return (
    <ServerError
      title="Something went wrong"
      message={
        import.meta.env.DEV && error instanceof Error
          ? error.message
          : "We're having trouble reaching our servers. Please try again."
      }
    />
  );
}
