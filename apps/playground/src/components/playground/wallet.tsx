import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton({ locale = "en" }: { locale?: "zh" | "en" }) {
  const account = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  if (account.address)
    return (
      <button className="wallet" type="button" onClick={() => disconnect()}>
        <i />
        {account.address.slice(0, 6)}…{account.address.slice(-4)}
      </button>
    );
  return (
    <button
      className="wallet"
      type="button"
      disabled={isPending || !connectors[0]}
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
    >
      <i />
      {isPending
        ? locale === "zh"
          ? "连接中…"
          : "Connecting…"
        : locale === "zh"
          ? "连接钱包"
          : "Connect wallet"}
    </button>
  );
}
