'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'You do not have permission to sign in.',
    Verification: 'The verification token has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="text-center">
      <div className="text-red-600 text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
      <p className="text-gray-600 mb-6">{errorMessage}</p>
      <Link
        href="/auth/signin"
        className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Back to Sign In
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <AuthErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
