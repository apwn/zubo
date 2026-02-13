# Contributing to Zubo

Thanks for your interest in contributing to Zubo! Whether you are fixing a bug, adding a feature, or writing a custom skill, we appreciate the help.

## Getting Started

```bash
git clone https://github.com/your-org/zubo.git
cd zubo
bun install
zubo setup
bun run dev
```

## Making Changes

1. Create a branch off `main` for your work.
2. Write your code. Zubo is built with Bun and TypeScript, so keep things typed.
3. Run tests before opening a PR:
   ```bash
   bun test
   ```
4. Make sure the project type-checks cleanly:
   ```bash
   npx tsc --noEmit
   ```

## Skills

Zubo supports custom skills -- self-contained TypeScript handlers that extend what the agent can do. You can contribute new skills by adding them to `~/.zubo/workspace/skills/`. Each skill is a TypeScript file that exports a handler. If you have an idea for a skill, open an issue first so we can discuss the design.

## Pull Requests

- Give your PR a clear, descriptive title.
- Explain what you changed and why.
- Make sure all tests pass and there are no type errors.
- Keep PRs focused. One concern per PR is easier to review.

## Reporting Bugs

If you run into a problem, please open an issue and include:

- A short description of the bug.
- Steps to reproduce it.
- What you expected to happen vs. what actually happened.
- Your OS and Bun version, if relevant.

## Documentation

For more details on how Zubo works, visit the docs: https://zubo.bot/docs

Thanks again for contributing.
