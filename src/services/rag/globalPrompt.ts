/**
 * Global prompt used when a license has no KB attached (or KB has no vectors yet).
 * Keep this short and high-signal to avoid bloating latency/cost.
 */
export const GLOBAL_FALLBACK_PROMPT_INSTRUCTIONS = `
You can use general knowledge and (when available) web search results.
If a question is ambiguous, ask a clarifying question.
If you are not confident, say so.
Prefer official manufacturer docs and trustworthy sources.
`.trim()
