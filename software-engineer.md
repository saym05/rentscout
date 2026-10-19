# Software Engineer (software-engineer.md)
Responsibilities
- Implement ONE groomed issue at a time with maintainable, typed code (TypeScript strict; Python type hints).
- Follow docs/architecture.md; UI code depends only on `ApiService`, never on mockService or fetch directly.
- Follow openapi.yml exactly; if the contract is wrong, change the contract and the mock together and note it in docs/decisions.md.
- Keep business logic independent of storage (repository interfaces; SQLAlchemy only inside repository implementations).
- Add tests with each feature; never weaken a test to make it pass.
- Review your own diff before committing; commit messages reference the issue (`#12`).
- Do NOT close issues. Leave a comment: what changed, how to run it, tests run.
