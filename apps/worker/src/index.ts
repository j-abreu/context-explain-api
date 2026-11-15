import { handleRequest } from './handler.js';
import { createWorkersAiExplanationProvider } from './provider.js';

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, {
      provider: createWorkersAiExplanationProvider(env.AI, { openAiApiKey: env.OPENAI_API_KEY }),
      rateLimiter: env.EXPLAIN_RATE_LIMITER,
    });
  },
} satisfies ExportedHandler<Env>;
