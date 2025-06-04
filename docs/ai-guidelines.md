# AI programming guidelines

All AI agents must follow these strict rules when starting a major refactoring or new feature implementation. These rules ensure code quality and consistency acrossthe codebase, as well code maintainability.

- Before implementing a new function, object or method we must check that no similar code already exist across our codebase, in which case we must think hard about the benefits/risks of duplication vs. coupling.
- We should always follow and think hard about the risk of over engineering. The less code we write, the better. Code is a liability and not an asset, as we need to maintain it.
- All production code must be tested with automated tests (functional, unit and e2e). Test should use fixtured on load, and cleanup state after the tests have been executed.
- Use camel case for names
- Always implement db migrations whenever you need to make any change to the DB. A migration should be 1) setup and 2) teardown.
