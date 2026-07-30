import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { defineChain } from "viem";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { MossGuardApp } from "../components/playground/app";

export const Route = createFileRoute("/")({ component: Page });

const monad = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
});
const wagmi = createConfig({
  chains: [monad],
  connectors: [injected()],
  transports: { [monad.id]: http() },
});
const query = new QueryClient();
function Page() {
  return (
    <ClientOnly fallback={<div className="app-loading">Loading guarded execution…</div>}>
      <WagmiProvider config={wagmi}>
        <QueryClientProvider client={query}>
          <MossGuardApp />
        </QueryClientProvider>
      </WagmiProvider>
    </ClientOnly>
  );
}
