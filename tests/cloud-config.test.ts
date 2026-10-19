import { expect, test } from 'vitest';
import { cloudConfiguration } from '../src/cloud/config';
const url = 'https://example-project.supabase.co';
test('unconfigured builds remain local, and configured builds accept only public client credentials', () => {
  expect(cloudConfiguration()).toBeNull();
  expect(cloudConfiguration(url, 'sb_publishable_example')?.url).toBe(url);
  const jwt = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`;
  expect(cloudConfiguration(url, jwt('anon'))?.key).toBe(jwt('anon'));
  for (const key of ['sb_secret_private', jwt('service_role'), '', 'not-a-key'])
    expect(() => cloudConfiguration(url, key)).toThrow();
});
test('project URLs cannot add credentials, arbitrary CSP origins or insecure network access', () => {
  for (const value of [
    'http://example-project.supabase.co',
    'https://evil.example',
    'https://user:pass@example-project.supabase.co',
    'https://example-project.supabase.co/path',
    'https://example-project.supabase.co/?token=x',
  ])
    expect(() => cloudConfiguration(value, 'sb_publishable_example')).toThrow();
});
