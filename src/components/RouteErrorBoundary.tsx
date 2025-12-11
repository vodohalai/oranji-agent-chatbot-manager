import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  let errorMessage: string;
  let errorStatus: number | undefined;
  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || 'An unexpected error occurred.';
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    console.error('Unknown routing error', error);
    errorMessage = 'An unknown error occurred.';
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4" role="alert">
      <div className="text-center max-w-md">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold text-destructive">
          {errorStatus ? `Error ${errorStatus}` : 'Oops! Something went wrong.'}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {errorMessage}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          We've logged the issue and are looking into it. Please try again later.
        </p>
        <Button onClick={() => navigate('/')} className="mt-6">
          Go back to Homepage
        </Button>
      </div>
    </div>
  );
}