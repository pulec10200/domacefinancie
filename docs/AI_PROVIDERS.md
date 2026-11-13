# AI providers

AI configuration and provider adapters are not implemented in 0.1.0. No cloud AI calls occur. There are no secret storage or routing controls to configure yet.

Required future contract: provider capability declaration, model ID, typed structured output, timeout/retry and budget controls, injected transport for offline tests, explicit task routing and per-provider document consent. Target adapters: OpenAI, Anthropic, Gemini, Ollama and OpenAI-compatible services. Validate against then-current official documentation before implementation. Use OS-backed secrets storage, refusing insecure plaintext fallback. No model may directly modify confirmed financial records.
