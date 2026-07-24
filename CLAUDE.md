# BridgX — project context for Claude Code

> Project-specific context layered on top of the global standards in `~/.claude/CLAUDE.md`.

## What it does
BridgX is a prototype cross-chain bridge composed of a Next.js frontend, a Python + FastAPI backend, and a Solidity source/destination-chain executor contracts. Hackathon MVP focused on WETH and wrapped BTC moving from Avalanche to Base, which can be easily expanded to 10+ chains and 100+ tokens.

## Stack
static / see README

## Commands
Static site — see README for the build/serve steps.

## Conventions
- Conventional commits, one logical change each; secrets never hardcoded; external API calls via a service layer; errors normalized before the client.
- Keep secrets out of the repo; document any build step in the README.

