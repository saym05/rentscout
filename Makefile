.PHONY: run test test-backend test-frontend e2e check-openapi
run:
	./run.sh
test: test-backend test-frontend check-openapi
test-backend:
	cd backend && uv run pytest
test-frontend:
	cd frontend && npm test && npm run typecheck
e2e:
	cd frontend && npm run e2e
check-openapi:
	python3 scripts/check_openapi.py
