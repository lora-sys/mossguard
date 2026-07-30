import { createFileRoute } from "@tanstack/react-router";
import { KURU_ROUTER_ADDRESS } from "@themoss/protocol-kuru";
import { USDC_ADDRESS } from "@themoss/system";
import { generateText, hasToolCall, tool } from "ai";
import { z } from "zod";
import { callOpenAICompatibleTool, getLanguageModel } from "../../server/ai/model";
import { parseModelActionProposal, parseModelIntentProposal } from "../../server/ai/proposal";
import { digest } from "../../server/crypto";
import { validateConfirmation } from "../../server/intent/service";
import { actionSchema, intentSchema } from "../../types/domain";

export const Route = createFileRoute("/api/propose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { model, provider, modelId } = getLanguageModel();
          if (body.phase === "intent") {
            const system =
              'Extract only the user\'s explicit onchain intent. Supported operations: transfer, approval, exact-input Kuru swap. Chain is Monad mainnet 143. Never guess unknown addresses. Use provided trusted context exactly. Call propose_intent with proposalJson containing exactly one JSON intent object, responseText containing one concise user-facing sentence, and planSteps containing 2-4 short public plan steps. planSteps are an auditable summary, never private chain-of-thought. Transfer fields: version=1, operation=transfer, chainId=143, optional sender, asset ({type:native,token:native,symbol:MON,decimals:18} or ERC-20 identity), amount (DECIMAL STRING, never a JSON number), recipient ({optional label,address,resolutionSource}). For an address typed by the user, recipient.resolutionSource must be exactly "user-input". Approval fields: version=1, operation=approval, chainId=143, optional owner, token ({address,symbol,decimals}), spender ({label,address,resolutionSource}), maxAmountDisplay, unlimitedAllowed=false. Approval maxAmountDisplay is a DECIMAL STRING containing digits only, such as "2.5", never "2.5 USDC". When the spender is Kuru Router from knownProtocols, spender.resolutionSource must be exactly "protocol-registry" and spender.address must equal knownProtocols.kuru.router. A correct Kuru approval spender is {"label":"Kuru Router","address":"0x...","resolutionSource":"protocol-registry"}. Swap fields: version=1, operation=swap, chainId=143, optional sender, protocol=kuru, tokenIn, tokenOut, amountIn, maxSlippageBps. IMPORTANT: swap tokenIn and tokenOut use the property name token, never address. A correct native tokenIn is {"token":"native","symbol":"MON","decimals":18}; a correct ERC-20 tokenOut is {"token":"0x...","symbol":"USDC","decimals":6}. Preserve the trusted context\'s exact addresses and property names.';
            const trustedContext = {
              ...body.context,
              knownAssets: {
                MON: { type: "native", token: "native", symbol: "MON", decimals: 18 },
                USDC: { token: USDC_ADDRESS, address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
              },
              knownProtocols: {
                kuru: { router: KURU_ROUTER_ADDRESS, displayName: "Kuru Router" },
              },
            };
            const prompt = `${body.prompt}\nResponse language: ${body.responseLocale === "zh" ? "Chinese" : "English"}.\nTrusted context: ${JSON.stringify(trustedContext)}`;
            if (provider === "stepfun") {
              const result = await callOpenAICompatibleTool({
                system,
                prompt,
                toolName: "propose_intent",
              });
              return Response.json({
                intent: parseModelIntentProposal(result.proposalJson),
                provider,
                model: modelId,
                responseText: result.responseText,
                planSteps: result.planSteps,
                toolCallId: result.toolCallId,
                attempts: result.attempts,
              });
            }
            let proposed: z.infer<typeof intentSchema> | undefined;
            const result = await generateText({
              model,
              stopWhen: hasToolCall("propose_intent"),
              toolChoice: { type: "tool", toolName: "propose_intent" },
              system,
              prompt,
              tools: {
                propose_intent: tool({
                  description:
                    "Propose a structured draft intent for user review. Does not build or verify transactions.",
                  inputSchema: z.object({
                    proposalJson: z
                      .string()
                      .describe("A JSON object matching the requested MossGuard Intent contract."),
                  }),
                  execute: async (input) => {
                    proposed = intentSchema.parse(JSON.parse(input.proposalJson));
                    return { acceptedForUserReview: true };
                  },
                }),
              },
            });
            if (!proposed)
              throw new Error(`Model did not call propose_intent (${result.finishReason})`);
            return Response.json({ intent: proposed, provider, model: modelId });
          }
          const secret = process.env.INTENT_SIGNING_SECRET ?? "";
          validateConfirmation(body.confirmedIntent, body.confirmationToken, secret);
          const system =
            'Independently propose the concrete onchain action implied by the confirmed intent. Do not copy hidden hashes or decide verification. Use base units only for ERC-20 approval; transfer and Kuru amountIn remain human decimal strings. Call propose_agent_action with proposalJson containing exactly one JSON action object, responseText containing one concise user-facing sentence, and planSteps containing 2-4 short public operation steps without hidden reasoning or a safety verdict. Transfer fields: version=1, operation=transfer, chainId=143, sender, asset ({type,token}), amount, recipient (ADDRESS STRING, not the intent recipient object). Approval fields: version=1, operation=approval, chainId=143, owner, token (TOKEN ADDRESS STRING, not the intent token object), spender (ADDRESS STRING, not the intent spender object), amountBaseUnits (decimal integer string computed from maxAmountDisplay and token decimals; for 10 USDC at 6 decimals use 10000000). Swap fields: version=1, operation=swap, chainId=143, sender, protocol=kuru, tokenIn (TOKEN STRING: native or address, never an object), tokenOut (TOKEN ADDRESS STRING, never an object), amountIn, slippageBps. For a MON-to-USDC swap, tokenIn must be exactly "native" and tokenOut must be the confirmed intent tokenOut.token address.';
          const prompt = `Confirmed user intent: ${JSON.stringify(body.confirmedIntent)}. Execution account: ${body.executionAccount}. Response language: ${body.responseLocale === "zh" ? "Chinese" : "English"}.`;
          if (provider === "stepfun") {
            const result = await callOpenAICompatibleTool({
              system,
              prompt,
              toolName: "propose_agent_action",
            });
            const action = parseModelActionProposal(result.proposalJson);
            return Response.json({
              action: {
                actionId: crypto.randomUUID(),
                actionHash: digest(action),
                status: "proposed",
                action,
                provenance: {
                  source: "live-ai",
                  provider,
                  model: modelId,
                  messageId: crypto.randomUUID(),
                  toolCallId: result.toolCallId ?? crypto.randomUUID(),
                  createdAt: new Date().toISOString(),
                },
              },
              responseText: result.responseText,
              planSteps: result.planSteps,
              toolCallId: result.toolCallId,
              attempts: result.attempts,
              provider,
              model: modelId,
            });
          }
          let proposed: z.infer<typeof actionSchema> | undefined;
          const result = await generateText({
            model,
            stopWhen: hasToolCall("propose_agent_action"),
            toolChoice: { type: "tool", toolName: "propose_agent_action" },
            system,
            prompt,
            tools: {
              propose_agent_action: tool({
                description: "Propose a concrete action after signed intent confirmation.",
                inputSchema: z.object({
                  proposalJson: z
                    .string()
                    .describe(
                      "A JSON object matching the requested MossGuard AgentAction contract.",
                    ),
                }),
                execute: async (input) => {
                  proposed = actionSchema.parse(JSON.parse(input.proposalJson));
                  return { proposed: true };
                },
              }),
            },
          });
          if (!proposed)
            throw new Error(`Model did not call propose_agent_action (${result.finishReason})`);
          const now = new Date().toISOString();
          return Response.json({
            action: {
              actionId: crypto.randomUUID(),
              actionHash: digest(proposed),
              status: "proposed",
              action: proposed,
              provenance: {
                source: "live-ai",
                provider,
                model: modelId,
                messageId: crypto.randomUUID(),
                toolCallId: result.toolCalls[0]?.toolCallId ?? crypto.randomUUID(),
                createdAt: now,
              },
            },
          });
        } catch (error) {
          return Response.json(
            {
              error: "Live AI request failed. No mock response was substituted.",
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
