'use client';

import React from 'react';
import { AccountResponse } from '@/lib/api/endpoints/accountApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { History, UserCheck, ShieldAlert } from 'lucide-react';

interface SuperAdminExtrasProps {
  extras: NonNullable<AccountResponse['adminExtras']>;
}

export function SuperAdminExtras({ extras }: SuperAdminExtrasProps) {
  const { loginAudit, debug } = extras;

  return (
    <div className="space-y-6">
      {/* 1. Login Audit History (Condensed) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Login History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="h-9 px-4 text-[11px] uppercase tracking-wider">Time</TableHead>
                <TableHead className="h-9 px-4 text-[11px] uppercase tracking-wider">Event</TableHead>
                <TableHead className="h-9 px-4 text-[11px] uppercase tracking-wider">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loginAudit.slice(0, 10).map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-2 px-4 text-xs font-mono">
                    {format(new Date(entry.timestamp), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell className="py-2 px-4">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      entry.event === 'session.created' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {entry.event.split('.')[1].toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-4 text-xs font-mono opacity-70">
                    {entry.ipAddress || '---'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. Session Claims (Simple List) */}
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Auth Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {Object.entries(debug.sessionClaims).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{key}</span>
                    <span className="text-xs font-mono break-all">{String(value)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 3. Cache Info (Simple Grid) */}
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Cache Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Mode</span>
                <Badge variant="outline" className="w-fit text-[10px] mt-1 capitalize">
                  {debug.casbinEnforceMode}
                </Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Version</span>
                <span className="text-xs font-mono mt-1">{debug.permissionCacheEntry?.version || 'N/A'}</span>
              </div>
            </div>
            <div className="flex flex-col pt-2 border-t">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Last Cached</span>
              <span className="text-xs font-mono mt-1">
                {debug.permissionCacheEntry ? format(new Date(debug.permissionCacheEntry.cachedAt), 'HH:mm:ss (MMM d)') : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
