'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function ApiTestPage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testBackendConnection = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);
    try {
      // Testing with employees endpoint as seen in taskApi.ts
      const data = await apiClient.get('/dashboard/overview');
      setResponse(data);
    } catch (err: any) {
      console.error('API Test Error:', err);
      setError(err.message || 'An error occurred during the API call');
      setResponse(err.body || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Backend Communication Test</h1>
      <p className="text-gray-500">
        This page tests the integration between Clerk authentication and the Backend API.
        It uses the <code>apiClient</code> which should automatically attach the Clerk JWT token.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Test Action</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={testBackendConnection} 
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              'Fetch Employees Data'
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold">Error Occurred</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {response && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold">Connection Successful</p>
            <p className="text-sm">Successfully received data from the backend.</p>
          </div>
        </div>
      )}

      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Response Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-[400px] text-xs">
              {JSON.stringify(response, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
