// Fetches live APY/TVL data from Stacks DeFi protocols via DefiLlama.
// Fallback: realistic mock data so the demo never breaks.

import axios from "axios";
import { YieldOpportunity } from "../types";

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";

const PROTOCOLS: Record<string, { name: string; asset: string; risk: "low" | "medium" | "high"; depositAddress: string; url: string }> = {
  "zest-protocol": {
    name: "Zest Protocol",
    asset: "sBTC",
    risk: "low",
    depositAddress: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
    url: "https://app.zestprotocol.com",
  },
  "bitflow": {
    name: "Bitflow",
    asset: "sBTC-STX LP",
    risk: "medium",
    depositAddress: "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1",
    url: "https://app.bitflow.finance",
  },
  "stackingdao": {
    name: "StackingDAO",
    asset: "STX → stSTX",
    risk: "low",
    depositAddress: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
    url: "https://stackingdao.com",
  },
};

async function fetchFromDefiLlama(): Promise<YieldOpportunity[]> {
  const res = await axios.get(DEFILLAMA_YIELDS_URL, { timeout: 10000 });
  const pools: any[] = res.data?.data ?? [];

  const stacksPools = pools.filter(
    (p: any) => p.chain === "Stacks" && Object.keys(PROTOCOLS).includes(p.project)
  );

  return stacksPools.map((pool: any) => {
    const proto = PROTOCOLS[pool.project];
    return {
      protocol: proto?.name ?? pool.project,
      asset: pool.symbol ?? proto?.asset ?? "Unknown",
      apy: (pool.apy ?? 0) / 100,
      tvl: pool.tvlUsd ?? 0,
      riskLevel: proto?.risk ?? "medium",
      depositAddress: proto?.depositAddress ?? "",
      url: proto?.url ?? "",
    };
  });
}

function getMockYields(): YieldOpportunity[] {
  return [
    {
      protocol: "Zest Protocol",
      asset: "sBTC",
      apy: 0.072,
      tvl: 4_200_000,
      riskLevel: "low",
      depositAddress: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
      url: "https://app.zestprotocol.com",
    },
    {
      protocol: "Bitflow",
      asset: "sBTC-STX LP",
      apy: 0.134,
      tvl: 2_100_000,
      riskLevel: "medium",
      depositAddress: "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1",
      url: "https://app.bitflow.finance",
    },
    {
      protocol: "StackingDAO",
      asset: "STX → stSTX",
      apy: 0.089,
      tvl: 18_000_000,
      riskLevel: "low",
      depositAddress: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
      url: "https://stackingdao.com",
    },
  ];
}

export async function fetchAllYields(): Promise<YieldOpportunity[]> {
  try {
    console.log("[Yield] Fetching live data from DefiLlama...");
    const liveData = await fetchFromDefiLlama();

    if (liveData.length >= 2) {
      console.log(`[Yield] Got ${liveData.length} live pools from DefiLlama`);

      const bestByProtocol = new Map<string, YieldOpportunity>();
      for (const pool of liveData) {
        const existing = bestByProtocol.get(pool.protocol);
        if (!existing || pool.apy > existing.apy) {
          bestByProtocol.set(pool.protocol, pool);
        }
      }

      const results = Array.from(bestByProtocol.values());

      // Fill missing protocols from mock
      const mock = getMockYields();
      for (const m of mock) {
        if (!results.find(r => r.protocol === m.protocol)) {
          results.push(m);
        }
      }

      return results.sort((a, b) => b.apy - a.apy);
    }

    console.log("[Yield] Insufficient live data, using mock fallback");
    return getMockYields().sort((a, b) => b.apy - a.apy);
  } catch (err: any) {
    console.log(`[Yield] DefiLlama unavailable (${err.message}), using mock data`);
    return getMockYields().sort((a, b) => b.apy - a.apy);
  }
}

export function generateReasoning(top: YieldOpportunity, all: YieldOpportunity[]): string {
  return (
    `${top.protocol} offers the highest APY at ${(top.apy * 100).toFixed(2)}% ` +
    `with ${top.riskLevel} risk and $${(top.tvl / 1_000_000).toFixed(1)}M TVL. ` +
    `Compared to ${all[1].protocol} (${(all[1].apy * 100).toFixed(2)}% APY, ${all[1].riskLevel} risk) ` +
    `and ${all[2].protocol} (${(all[2].apy * 100).toFixed(2)}% APY, ${all[2].riskLevel} risk). ` +
    `Recommended deposit: ${top.asset} at ${top.depositAddress}.`
  );
}
