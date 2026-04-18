"""Market category classifier based on keyword matching."""
from __future__ import annotations

import re

_CRYPTO = re.compile(
    r'\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|blockchain|defi|nft|'
    r'altcoin|binance|coinbase|doge|dogecoin|xrp|ripple|cardano|ada|'
    r'polygon|matic|avalanche|avax|chainlink|uniswap|uni|'
    r'halving|token|coin|exchange|market cap|'
    r'will .{0,10}reach|\$[0-9]|hit \$|above \$|below \$|price target|'
    r'bull|bear|pump|dump|moon|rekt|hodl|satoshi|wei|gwei|'
    r'layer.?2|rollup|staking|yield|liquidity pool|amm|dex|cex)\b',
    re.IGNORECASE,
)

_SPORTS = re.compile(
    r'\b(nfl|nba|mlb|nhl|mls|pga|ufc|mma|'
    r'soccer|football|basketball|baseball|hockey|tennis|golf|'
    r'atp|wta|wimbledon|us open|french open|australian open|roland garros|'
    r'super bowl|world cup|champions league|premier league|la liga|'
    r'serie a|bundesliga|europa league|'
    r'formula.?1|f1|grand prix|nascar|indycar|'
    r'boxing|wrestling|rugby|cricket|'
    r'playoff|championship|tournament|semifinal|final|'
    r'win the|beat the|defeat|score|goal|touchdown|homerun|slam)\b',
    re.IGNORECASE,
)

_POLITICS = re.compile(
    r'\b(president|election|vote|voting|senator|congress|house|senate|'
    r'democrat|republican|biden|trump|harris|kamala|gop|dnc|rnc|'
    r'governor|mayor|poll|approval rating|impeach|supreme court|'
    r'legislation|bill|policy|cabinet|administration|executive order|'
    r'primary|caucus|ballot|candidate|party|political|'
    r'prime minister|chancellor|parliament|eu|nato|un|g7|g20|'
    r'foreign policy|sanctions|treaty|embassy|diplomat|'
    r'ukraine|russia|china|taiwan|iran|north korea|israel|gaza|'
    r'federal reserve(?! rate)|white house|capitol|kremlin)\b',
    re.IGNORECASE,
)

_NEWS = re.compile(
    r'\b(breaking|headline|disaster|earthquake|hurricane|tornado|flood|wildfire|'
    r'war|conflict|attack|invasion|bombing|shooting|crash|accident|'
    r'stock market|recession|inflation|gdp|unemployment|fed rate|interest rate|'
    r'earnings|ipo|merger|acquisition|bankruptcy|'
    r'ai|artificial intelligence|gpt|openai|anthropic|llm|'
    r'celebrity|oscar|grammy|emmy|golden globe|award|'
    r'climate|global warming|carbon|temperature record|'
    r'covid|pandemic|vaccine|virus|outbreak|epidemic|'
    r'tech|apple|google|microsoft|amazon|meta|nvidia|tesla)\b',
    re.IGNORECASE,
)


def classify_market(question: str) -> str:
    """Return one of: crypto | sports | politics | news | trending"""
    q = question or ""

    scores = {
        "crypto":   len(_CRYPTO.findall(q)),
        "sports":   len(_SPORTS.findall(q)),
        "politics": len(_POLITICS.findall(q)),
        "news":     len(_NEWS.findall(q)),
    }

    best_cat, best_score = max(scores.items(), key=lambda x: x[1])
    return best_cat if best_score > 0 else "trending"
