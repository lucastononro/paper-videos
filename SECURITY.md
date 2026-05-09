# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public issue**.
Instead, email **ltononro@gmail.com** with:

- A description of the vulnerability and its impact
- Steps to reproduce
- (Optional) A proposed fix

You can expect:

- An acknowledgement within 72 hours
- A first assessment within 7 days
- A fix or mitigation in the next minor release if confirmed

## Scope

paper-videos is a local content-generation framework. It calls a few external
services (ElevenLabs API for TTS, arXiv for paper download, package registries
for dependencies). Out-of-scope:

- Vulnerabilities in `references/raw-packages/*` submodules — report those
  upstream (Manim, Remotion, 3b1b/videos)
- Issues in your own ElevenLabs API key handling outside this repo
- Anything depending on a malicious paper PDF the user themselves chose to feed
  to the pipeline (we trust the user's input by design)

## Secret hygiene

The repo's `.gitignore` excludes `.env` and `.env.*` (except `.env.example`).
If you accidentally commit a real `ELEVENLABS_API_KEY`, rotate it immediately
in the ElevenLabs dashboard, then `git rm --cached` and force-push if the
branch is private; if the commit reached `origin/main`, treat the key as
compromised regardless.
