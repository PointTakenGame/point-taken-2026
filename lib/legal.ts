/**
 * The two legal pages, and the cookie that says a visitor has read them.
 *
 * The pages are on the marketing site rather than in this app, and both were
 * confirmed live on 2026-09-04 (`/terms` and `/privacy` are 404s there; these
 * two are the real paths). They are written down once, here, because the tick
 * box that links them and the route handler that refuses to mint an account
 * without it have to agree about what was agreed to.
 */

export const TERMS_URL = "https://pointtaken.social/terms-of-use";
export const PRIVACY_URL = "https://pointtaken.social/privacy-policy";

/**
 * Set to "1" in the browser when the visitor ticks the box.
 *
 * It is a plain cookie rather than a database column on purpose: the agreement
 * has to happen before there is an account to hang it on, which is the whole
 * point of gating the mint with it. Once an account exists, the fact that it
 * exists is the record that somebody agreed, because nothing else can make one.
 */
export const AGREEMENT_COOKIE = "pt-terms-agreed";

/** A year. Long enough that nobody is asked twice on the same machine. */
export const AGREEMENT_MAX_AGE = 60 * 60 * 24 * 365;
