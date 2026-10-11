# Security Policy

CodeBox runs untrusted user code, so security reports are taken seriously.
Thank you for helping keep CodeBox and its users safe.

## Supported Versions

CodeBox does not yet publish versioned releases. Security fixes are made on
the `main` branch and shipped in the latest Docker Hub images
(`hiteshchoudhary/codebox-api:latest` and `hiteshchoudhary/codebox-worker:latest`).

| Version                      | Supported |
| ---------------------------- | --------- |
| `main` / `latest` images     | Yes       |
| Older commits and images     | No        |

Please make sure an issue still reproduces on the latest `main` before
reporting it.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, or discussions.**

Report them privately through GitHub:

1. Go to the [Security tab](https://github.com/hiteshchoudhary/Codebox/security) of this repository.
2. Click **Report a vulnerability**.
3. Fill in the advisory form.

Please include as much of the following as you can:

- The type of issue (for example, sandbox escape, auth bypass, resource-limit bypass)
- The executor in use (`isolate`, `firecracker`, or `docker`) and the host OS
- The affected file(s), endpoint(s), or configuration
- Step-by-step instructions to reproduce, including any submitted source code
- A proof of concept, if you have one
- The impact, and how an attacker could exploit it

## What to Expect

- We aim to acknowledge your report within **3 business days**.
- We will keep you updated as we confirm the issue and work on a fix.
- Once a fix is available, we will publish a GitHub Security Advisory and
  credit you, unless you prefer to stay anonymous.

Please give us reasonable time to fix the issue before disclosing it publicly.

## Scope

Examples of issues we especially want to hear about:

- Escaping the execution sandbox (isolate, Firecracker, or Docker) to the
  worker or host
- User code reaching the network when networking should be disabled
- Bypassing CPU, memory, process, or time limits
- Bypassing `AUTH_TOKEN` authentication on the API
- Reading or tampering with other users' submissions or results
- Injection through submission fields (language, stdin, arguments, and so on)

Out of scope:

- Issues that require an already-compromised host, or a deployment that
  ignores the hardening steps in the [README](README.md)
- Denial of service that only uses traffic volume within the configured rate limits
- Vulnerabilities in third-party dependencies with no demonstrated impact on
  CodeBox (please report those upstream)

