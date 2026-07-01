"""Network defaults for public market-data providers."""

from __future__ import annotations

import os


DATA_PROVIDER_NO_PROXY = (
    "fund.eastmoney.com",
    "fundmobapi.eastmoney.com",
    "push2.eastmoney.com",
    "push2his.eastmoney.com",
    "query1.finance.yahoo.com",
    "fundgz.1234567.com.cn",
    "qt.gtimg.cn",
    ".eastmoney.com",
    ".1234567.com.cn",
    ".gtimg.cn",
)


def apply_data_provider_no_proxy() -> None:
    """Bypass local/system proxies for public fund-data endpoints.

    On macOS, Python's urllib/requests stack can pick up system proxy settings
    even when proxy environment variables are not present. Some Eastmoney fund
    endpoints fail through that local proxy with SSLEOFError, while direct
    connections succeed.
    """

    for key in ("NO_PROXY", "no_proxy"):
        existing = [item.strip() for item in os.getenv(key, "").split(",") if item.strip()]
        merged = existing[:]
        for domain in DATA_PROVIDER_NO_PROXY:
            if domain not in merged:
                merged.append(domain)
        os.environ[key] = ",".join(merged)

