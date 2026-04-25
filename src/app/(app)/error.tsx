"use client";

/**
 * Segment-level error boundary untuk semua route di grup `(app)`.
 *
 * Next.js 15 App Router mounts file ini saat ada thrown error dari
 * server component / client component / data fetching di subtree-nya.
 * Tanpa error boundary, error meledak ke root dan user lihat layar putih.
 *
 * Boundary ini sengaja minimalis: judul + pesan singkat + tombol coba
 * lagi (calling `reset()` me-remount subtree). Untuk debugging,
 * `error.digest` ditampilkan supaya tim bisa cross-check di server log.
 */

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console + downstream observability hook (Sentry/LogRocket
    // bisa pasang listener di sini saat dipasang nanti).
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Terjadi Kesalahan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Halaman tidak bisa ditampilkan karena ada error tak terduga. Coba
            muat ulang. Kalau masih bermasalah, hubungi tim Backoffice dan
            sertakan kode error di bawah.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">
              Kode: {error.digest}
            </p>
          ) : null}
          {process.env.NODE_ENV !== "production" ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {error.message}
            </pre>
          ) : null}
          <div className="flex gap-2">
            <Button onClick={reset} size="sm">
              Coba Lagi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.assign("/dashboard")}
            >
              Kembali ke Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
