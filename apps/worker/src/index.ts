import { handleRequest, type ExplainRateLimiter } from './handler.js';
import {
  createWorkersAiExplanationProvider,
  type WorkersAiBinding,
} from './provider.js';

interface Env {
  AI: WorkersAiBinding;
  EXPLAIN_RATE_LIMITER: ExplainRateLimiter;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, {
      provider: createWorkersAiExplanationProvider(env.AI),
      rateLimiter: env.EXPLAIN_RATE_LIMITER,
    });
  },
};
