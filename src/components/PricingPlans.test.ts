import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PricingPlans from './PricingPlans.tsx';

test('Monthly and Yearly do not repeat the same text: Yearly says what paying once a year saves', () => {
  const html = renderToStaticMarkup(createElement(PricingPlans, { action: () => null }));
  const card = (id: string) => html.split(`data-testid="plan-${id}"`)[1].split('</section>')[0];
  const monthly = card('monthly');
  const yearly = card('yearly');
  assert.match(monthly, /Every Woodpecker set/);
  assert.doesNotMatch(yearly, /Every Woodpecker set, up to 9/);
  assert.match(yearly, /Everything in Monthly/);
  assert.match(yearly, /Save \$19\.89 a year, about 4 months free/);
  assert.match(yearly, /One payment a year/);
});
