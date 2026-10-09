export function formatMoney(value: number | null | undefined, moneda = 'USD') {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: moneda }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-EC').format(value);
}

export function formatKg(value: number | null | undefined) {
  if (value == null) return '—';
  return `${formatNumber(value)} kg`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function extractApiError(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = (err.response as { data?: { message?: string | string[] } }).data;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  return fallback;
}
