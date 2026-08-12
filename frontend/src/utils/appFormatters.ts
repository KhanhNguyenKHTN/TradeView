export function displayPrice(asset: any) {
    console.log(asset);
  if (asset.categoryCode === 'SAVING') {
    return "-";
  }
  return formatCurrency(asset.latestPrice);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatCurrencyPreview(value: string) {
  const normalizedValue = value.trim().replace(/,/g, '');
  const parsedValue = Number(normalizedValue);

  if (!normalizedValue || Number.isNaN(parsedValue)) {
    return '';
  }

  return formatCurrency(parsedValue);
}

export function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function toDateTimeLocalValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}