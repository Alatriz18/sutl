'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';

export default function TrackingSearchPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (codigo.trim()) {
      router.push(`/tracking/${codigo.trim().toUpperCase()}`);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-radial px-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft size={14} />
          Volver al inicio
        </Link>
        <Card className="text-center shadow-2xl shadow-black/30">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky/10 text-sky">
            <Search size={20} />
          </span>
          <CardTitle>Rastrea tu envío</CardTitle>
          <p className="mt-1 text-sm text-navy/60">
            Ingresa el código de guía que te compartió la empresa transportista.
          </p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="SUTL-XXXXXXXX"
              required
              className="text-center"
            />
            <Button type="submit">Consultar</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
