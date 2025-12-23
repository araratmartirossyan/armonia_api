import axios from 'axios';
import type {
  OpenAIResponsesCreateRequest,
  OpenAIResponsesCreateResponse,
  UrlCitation,
  WebSearchParams,
} from '../types/openai';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function extractTextAndCitationsFromResponsesApi(responseBody: unknown): { text: string; citations: UrlCitation[] } {
  const citations = new Map<string, UrlCitation>();
  const textParts: string[] = [];

  if (!isRecord(responseBody)) return { text: '', citations: [] };

  const direct = responseBody.output_text;
  const directText = typeof direct === 'string' ? direct : '';

  const output = responseBody.output;
  const outputItems = Array.isArray(output) ? output : [];

  for (const item of outputItems) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;

    const content = item.content;
    const contentArr = Array.isArray(content) ? content : [];
    for (const part of contentArr) {
      if (!isRecord(part)) continue;

      const maybeText = part.text ?? part.content;
      if (typeof maybeText === 'string' && maybeText.trim()) textParts.push(maybeText);

      const annotations = part.annotations;
      const annArr = Array.isArray(annotations) ? annotations : [];
      for (const ann of annArr) {
        if (!isRecord(ann)) continue;
        const annType = ann.type;
        if (annType !== 'url_citation' && annType !== 'url-citation') continue;

        const url =
          typeof ann.url === 'string'
            ? ann.url
            : isRecord(ann.url_citation) && typeof ann.url_citation.url === 'string'
              ? ann.url_citation.url
              : '';
        const title =
          typeof ann.title === 'string'
            ? ann.title
            : isRecord(ann.url_citation) && typeof ann.url_citation.title === 'string'
              ? ann.url_citation.title
              : undefined;

        if (url) citations.set(url, { url, title });
      }
    }
  }

  const text = (directText || textParts.join('\n')).trim();
  return { text, citations: Array.from(citations.values()) };
}

export async function openAIWebSearchAnswer(
  params: WebSearchParams,
): Promise<{ answerMarkdown: string; citations: UrlCitation[] }> {
  const isGpt5Family = /^gpt-5/i.test(params.model);

  const input: OpenAIResponsesCreateRequest['input'] = [
    { role: 'system', content: params.systemRules },
    ...(Array.isArray(params.history) ? params.history.slice(-12) : []),
    { role: 'user', content: `USER QUESTION:\n${params.question}\n\nRemember: output Markdown.` },
  ];

  const tools: OpenAIResponsesCreateRequest['tools'] = [
    {
      type: 'web_search',
      ...(params.externalWebAccess === false ? { external_web_access: false } : {}),
    },
  ];

  const body: OpenAIResponsesCreateRequest = {
    model: params.model,
    input,
    tools,
    max_output_tokens: params.maxOutputTokens ?? 1200,
    top_p: params.topP ?? undefined,
    frequency_penalty: params.frequencyPenalty ?? undefined,
    presence_penalty: params.presencePenalty ?? undefined,
  };

  if (!isGpt5Family && typeof params.temperature === 'number') {
    body.temperature = params.temperature;
  }

  const resp = await axios.post<OpenAIResponsesCreateResponse>('https://api.openai.com/v1/responses', body, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60_000,
  });

  const { text, citations } = extractTextAndCitationsFromResponsesApi(resp.data);
  const outputText = typeof resp.data?.output_text === 'string' ? resp.data.output_text : '';
  return { answerMarkdown: text || outputText, citations };
}
