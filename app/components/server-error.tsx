import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface ServerErrorProps {
  title?: string;
  message?: string;
}

export function ServerError({
  title = "Something went wrong",
  message = "We're having trouble reaching our servers. This could be a temporary issue — please try again in a moment.",
}: ServerErrorProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-white px-4 py-16">
      <img
        src={`${import.meta.env.BASE_URL}server-error.svg`}
        alt="Server error illustration"
        className="w-full max-w-sm"
        draggable={false}
      />

      <div className="text-center space-y-2 max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </div>
  );
}
