'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';

export default function TwoFactorAuthPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'recovery'>('initial');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  
  const has2FA = session?.user?.totpConfigured;

  const handleSetup2FA = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/totp/setup', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup 2FA');
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('setup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify token');
      }

      setSuccess('Google Authenticator 2FA enabled. Store recovery codes before leaving this page.');
      setBackupCodes(data.backupCodes || []);
      setStep('recovery');
      setVerificationToken('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, token: disableToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable 2FA');
      }

      setSuccess('2FA has been disabled successfully.');
      setPassword('');
      setDisableToken('');
      
      // Refresh session
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            2FA Security Control
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
              {success}
            </div>
          )}

          {step === 'initial' && (
            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Status</p>
                    <p className="text-sm text-gray-600">
                      {has2FA ? '2FA is currently enabled' : '2FA is currently disabled'}
                    </p>
                  </div>
                  <div>
                    {has2FA ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`mb-6 rounded-lg border p-4 ${has2FA ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${has2FA ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {has2FA ? 'Google Authenticator protection is ON' : 'Google Authenticator protection is OFF'}
                    </p>
                    <p className={`mt-1 text-xs ${has2FA ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {has2FA ? 'Disable using your password and a valid current authenticator or recovery code.' : 'Enable it to protect future sign-ins with a verification code.'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${has2FA ? 'bg-emerald-700 text-white' : 'bg-amber-600 text-white'}`}>
                    {has2FA ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">About 2FA</h2>
                <p className="text-gray-600 mb-4">
                  Google Authenticator adds a time-based code to your password. A fresh code or
                  single-use recovery code is required each time you sign in.
                </p>
              </div>

              {!has2FA ? (
                <button
                  onClick={handleSetup2FA}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Enable 2FA'}
                </button>
              ) : (
                <form onSubmit={handleDisable2FA}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter password and current code to disable 2FA
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Your password"
                    />
                    <input
                      type="text"
                      value={disableToken}
                      onChange={(e) => setDisableToken(e.target.value.toUpperCase())}
                      required
                      className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Google Authenticator or recovery code"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                </form>
              )}
            </div>
          )}

          {step === 'setup' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Scan QR Code</h2>
              
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Open Google Authenticator, choose Add code, then scan this QR code:
                </p>
                <div className="flex justify-center mb-4">
                  <Image
                    src={qrCode}
                    alt="2FA QR Code"
                    width={250}
                    height={250}
                    className="border border-gray-300 rounded"
                  />
                </div>
                
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Can't scan? Enter this code manually:
                  </p>
                  <code className="block text-sm bg-white p-2 rounded border border-gray-300 font-mono break-all">
                    {secret}
                  </code>
                </div>
              </div>

              <button
                onClick={() => setStep('verify')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Next: Verify Code
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Verify Your Setup</h2>
              
              <form onSubmit={handleVerifyAndEnable}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter the 6-digit code from your authenticator app:
                  </label>
                  <input
                    type="text"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="000000"
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('setup')}
                    disabled={loading}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || verificationToken.length !== 6}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Enable 2FA'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 'recovery' && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Save Recovery Codes</h2>
              <p className="text-sm text-gray-600 mb-4">Each code works once. Store these outside this system. They cannot be shown again.</p>
              <div className="grid grid-cols-1 gap-2 rounded border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
                {backupCodes.map((code) => <code key={code} className="rounded bg-white px-3 py-2 text-center font-mono text-sm text-gray-900">{code}</code>)}
              </div>
              <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="mt-5 w-full bg-green-700 text-white py-3 px-4 rounded-md hover:bg-green-800">I saved my recovery codes. Sign in again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
