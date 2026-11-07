// USD per million standard text tokens. Conservative billing ignores cache discounts.
// Verified 2026-11-07 against the linked official model rate cards.
export const PRICE_VERSION = 'openai-standard-text-2026-11-07';
export const prices = Object.freeze({
  'gpt-4.1-mini': { input: 0.4, output: 1.6, source: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini' },
  'gpt-5.4-mini': { input: 0.75, output: 4.5, source: 'https://developers.openai.com/api/docs/models/gpt-5.4-mini' },
  'gpt-5.4': { input: 2.5, output: 15, source: 'https://developers.openai.com/api/docs/models/gpt-5.4' },
});
export function modelPrice(model) {
  const alias = Object.keys(prices).find((key) => model === key || new RegExp('^' + key.replaceAll('.', '\\.') + '-\\d{4}-\\d{2}-\\d{2}$').test(model));
  return alias ? prices[alias] : null;
}
export function reserveCost(tokens, price) { return Math.ceil(tokens * Math.max(price.input, price.output)); }
export function actualCost(usage, price) { return Math.ceil(usage.input_tokens * price.input + usage.output_tokens * price.output); }
