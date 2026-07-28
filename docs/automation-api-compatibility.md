# JL Mixing Studio Automation API Compatibility Policy

## Purpose

JL Mixing Studio and JL Mixing Automation use independent product versions. Studio determines compatibility from the Automation API version declared by the provider, not from the Automation application release number.

## Studio v1.1 supported provider contract

JL Mixing Studio v1.1 supports JL Mixing Automation API `1.0`.

Studio must query the provider through the machine-readable discovery command:

```text
jl-mixing system-info --json
```

The response must declare `api_version: "1.0"` and the capabilities required by the workflow Studio intends to use.

The initial Studio v1.1 provider capability set is:

- `system.info`
- `client.create`
- `project.create`
- `revision.create`
- `intake.validate`
- `revision.approve`
- `delivery.create`

Studio must not infer compatibility from the Automation product version or from metadata schema versions.

## Compatibility rule

Studio v1.1 accepts Automation API `1.0` exactly.

A future Studio release may broaden this rule only after the provider compatibility guarantees and Studio tests explicitly support that range. A future Automation application release may remain compatible with Studio v1.1 while retaining API `1.0`.

## Discovery and validation behavior

Before enabling an Automation-backed workflow, Studio must use a single centralized discovery and validation path that:

1. locates the Automation executable using Studio-owned discovery rules;
2. invokes `jl-mixing system-info --json`;
3. requires exactly one valid JSON discovery document;
4. validates the declared API version;
5. validates the capability required by the requested workflow; and
6. returns a structured Studio compatibility result to callers.

Packaged and development builds must use the same compatibility rules.

## Failure classes

Studio must distinguish these conditions rather than reducing them to a generic process error:

- **Automation missing** — no usable Automation executable can be located.
- **Invocation failed** — Automation was located but discovery could not be executed successfully.
- **Malformed response** — discovery output is not valid or cannot be parsed as the expected document.
- **API unavailable** — the discovery document does not provide a usable API declaration.
- **API incompatible** — the declared API version is not supported by Studio v1.1.
- **Capability unavailable** — API `1.0` is supported but the required workflow capability is not advertised.

These conditions must be represented as stable structured Studio errors by the abstraction layer introduced in issue #75.

## Graceful degradation

Failure to locate or validate Automation must not make Studio itself unusable. Studio must continue to open and provide non-Automation functionality. Automation-backed actions must be disabled or fail cleanly with a user-readable explanation derived from the structured compatibility error.

Studio must not silently fall back to constructing legacy workflow commands when the provider API is missing or incompatible. Such fallback would bypass the compatibility contract.

## Workflow ownership

The Automation repository owns provider behavior, API schemas, capability names, response envelopes, and machine error codes.

The Studio repository owns:

- which Automation API versions Studio supports;
- executable discovery and compatibility validation;
- mapping provider responses into Studio domain results;
- user-visible graceful degradation; and
- consumer integration and regression tests.

## Versioning implications

Studio and Automation product releases remain independently versioned. For example, a future Automation `1.x` or `2.x` product release may remain compatible with Studio v1.1 if it still provides the Automation API `1.0` contract consumed by Studio.

Conversely, matching product version numbers do not imply compatibility.

## Implementation dependencies

This policy is the basis for:

- issue #75 — Studio-side Automation API abstraction layer;
- issue #76 — centralized discovery and API-version validation; and
- issue #77 — Automation API compatibility integration tests.

Provider contract: `JLAudio/jl-mixing#44`.
