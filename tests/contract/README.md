# Contract Tests

Contract tests verify the external boundaries of a module: input shapes,
output shapes, error shapes, and ownership of responsibilities.

They are introduced **per Proposal** when a module gains a public contract.
The Bootstrap stage has no module contracts to test, so this directory is
intentionally empty.

Rules:

- One contract test file per owned contract.
- Contracts must be expressed with Zod schemas.
- A change that breaks a contract test is a Proposal-grade event — it must
  not be silently fixed by relaxing the assertion.
