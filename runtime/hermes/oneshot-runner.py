#!/usr/bin/env python3
"""runtime/hermes/oneshot-runner.py — Hermes one-shot with forced plugin discovery.

This runner is a small adapter-internal helper for `HermesSubprocessClient`.
The plain `hermes -z` CLI entry point does not eagerly trigger Hermes's
plugin discovery, so a freshly installed web provider (e.g. the bundled
`web/ddgs` plugin) is invisible to the one-shot process. The first web
tool call fails with "provider 'ddgs' is not registered" even when the
plugin is present and the Python package is importable.

The fix: in a single Python process, force plugin discovery first, then
call `hermes_cli.oneshot.run_oneshot(...)` directly. The discovery state
populates the same in-process registry that the one-shot agent reads, so
the web tool resolves correctly.

This module is `runtime/hermes/*` only and does not change the Radar
Domain or the neutral `RuntimeAdapter` seam. Per ADR-016, Hermes's
internal startup quirks are the adapter's problem.

CLI surface mirrors `hermes -z`:

    python3 oneshot-runner.py --hermes-home <PATH> --prompt "..." [--model M]
                              [--provider P] [--toolsets web] [--safe-mode]

Prints the final response text on stdout, the same contract the
`HermesSubprocessClient` expects.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Optional, Sequence


def _force_plugin_discovery(hermes_home: str) -> None:
    """Pre-discover Hermes plugins so the web provider registry is populated.

    Idempotent. Mirrors `_ensure_web_plugins_loaded` from
    `tools/web_tools.py` but runs *before* AIAgent construction, so the
    web tool resolves on the first call rather than the first invocation
    failing.
    """
    plugin_root = Path(hermes_home) / "hermes-agent"
    if not plugin_root.is_dir():
        raise FileNotFoundError(
            f"HERMES_HOME does not contain a hermes-agent/ directory: {hermes_home}"
        )
    if str(plugin_root) not in sys.path:
        sys.path.insert(0, str(plugin_root))

    from hermes_cli.plugins import _ensure_plugins_discovered  # type: ignore[import-not-found]

    _ensure_plugins_discovered(force=True)


def _run_oneshot(
    prompt: str,
    model: Optional[str],
    provider: Optional[str],
    toolsets: Optional[str],
    safe_mode: bool,
) -> int:
    """Call `hermes_cli.oneshot.run_oneshot` with the parsed args.

    Returns the exit code. The runner's stdout is already configured by
    `run_oneshot` to be the final response only (no banner, no spinner).
    """
    from hermes_cli.oneshot import run_oneshot  # type: ignore[import-not-found]

    if safe_mode:
        os.environ["HERMES_SAFE_MODE"] = "1"
    return run_oneshot(
        prompt=prompt,
        model=model,
        provider=provider,
        toolsets=toolsets,
    )


def _parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="oneshot-runner.py",
        description="Hermes one-shot runner with forced plugin discovery.",
    )
    parser.add_argument(
        "--hermes-home",
        default=os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")),
        help="Path to the Hermes home directory (default: $HERMES_HOME or ~/.hermes).",
    )
    parser.add_argument("--prompt", required=True, help="The prompt to send.")
    parser.add_argument("--model", default=None, help="Optional model override.")
    parser.add_argument("--provider", default=None, help="Optional provider override.")
    parser.add_argument(
        "--toolsets",
        default=None,
        help="Comma-separated toolset names (e.g. 'web').",
    )
    parser.add_argument(
        "--safe-mode",
        action="store_true",
        default=True,
        help="Run in safe mode (default: on).",
    )
    parser.add_argument(
        "--no-safe-mode",
        dest="safe_mode",
        action="store_false",
        help="Disable safe mode.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)
    _force_plugin_discovery(args.hermes_home)
    return _run_oneshot(
        prompt=args.prompt,
        model=args.model,
        provider=args.provider,
        toolsets=args.toolsets,
        safe_mode=args.safe_mode,
    )


if __name__ == "__main__":
    sys.exit(main())
