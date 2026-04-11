# Contributing to BridgX

Thanks for your interest in improving BridgX.

## Development Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --port 4000
```

## Branching and Commits

- Create focused branches per feature/fix.
- Keep commits atomic and descriptive.
- Reference issue IDs in commit messages where possible.

## Code Quality Expectations

- Prefer explicit typing in TypeScript and Python models.
- Keep API contract changes synchronized across backend and frontend types.
- Add/update tests whenever behavior changes.
- Preserve clear error handling semantics.

## Pull Requests

PRs should include:
- What changed.
- Why it changed.
- How it was tested.
- Any migration or compatibility notes.

## Suggested Next Contributions

- Implement missing bridge orchestration endpoints.
- Add persistent state storage for transfer lifecycle.
- Build e2e tests covering quote -> initiate -> completion flow.
- Improve observability (metrics + tracing).
