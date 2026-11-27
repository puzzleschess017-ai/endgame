import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { showsSignupPrompt, signUpHref } from './signup.ts';

describe('showsSignupPrompt', () => {
  it('the training pages, the tools and the whole library', () => {
    for (const path of ['/woodpecker', '/streak', '/survival', '/coordinates', '/editor', '/analysis', '/endgames', '/openings', '/tactics', '/ebooks']) {
      assert.equal(showsSignupPrompt(path), true, path);
    }
  });
  it('a lesson is part of its library, and a slash at the end does not matter', () => {
    assert.equal(showsSignupPrompt('/endgames/lucena-position'), true);
    assert.equal(showsSignupPrompt('/openings/italian-game'), true);
    assert.equal(showsSignupPrompt('/tactics/fork/'), true);
    assert.equal(showsSignupPrompt('/streak/'), true);
  });
  it('not Home, Blindfold, Pricing, Statistics, the login and the legal pages', () => {
    for (const path of ['/', '/blindfold', '/pricing', '/statistics', '/login', '/about', '/privacy', '/terms', '/refunds', '/contact']) {
      assert.equal(showsSignupPrompt(path), false, path);
    }
  });
  it('a path that only starts with the same letters is not the page', () => {
    assert.equal(showsSignupPrompt('/streaks'), false);
    assert.equal(showsSignupPrompt('/analysis-tools'), false);
  });
});

describe('signUpHref', () => {
  it('opens the sign-up tab and comes back to the page', () => {
    assert.equal(signUpHref('/streak'), '/login?tab=signup&next=%2Fstreak');
    assert.equal(signUpHref('/endgames/lucena-position'), '/login?tab=signup&next=%2Fendgames%2Flucena-position');
  });
});
